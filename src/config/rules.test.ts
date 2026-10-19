import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_DIR } from './paths.js';
import { loadRules } from './rules.js';

async function project(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'code-audit-rules-'));
}

async function rule(root: string, folder: string, file: string, content: string): Promise<void> {
  const path = join(root, CONFIG_DIR, folder, file);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content);
}

const header = (fields: string, body = 'Rule body.'): string => `---\n${fields}\n---\n${body}\n`;

describe('loadRules', () => {
  it('loads rules recursively, sorts by repository-relative file, and omits README files', async () => {
    const root = await project();
    try {
      await rule(root, 'rules', 'z.md', header('id: R-2\ntitle: Z\nseverity: major\napplies_to: src/**'));
      await rule(root, 'rules', 'nested/a.md', header('id: R-1\ntitle: A\nseverity: minor\napplies_to:\n  - src/**'));
      await rule(root, 'rules', 'nested/README.md', header('id: NO\ntitle: Readme\nseverity: minor'));
      const result = await loadRules(root);
      expect(result.rules.map((item) => item.file)).toEqual([
        `${CONFIG_DIR}/rules/nested/a.md`, `${CONFIG_DIR}/rules/z.md`,
      ]);
      expect(result.rules[0]).toMatchObject({ kind: 'rule', appliesTo: ['src/**'], keywords: [], body: 'Rule body.\n' });
      expect(result.problems).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('normalizes severity aliases and Spanish names case-insensitively', async () => {
    const root = await project();
    try {
      await rule(root, 'business', 'a.md', header('id: B-1\ntitle: Money\nseverity: grave\napplies_to: src/**\nkeywords: [precio, total]'));
      await rule(root, 'business', 'b.md', header('id: B-2\ntitle: Total\nseverity: IMPORTANTE\napplies_to: src/**'));
      await rule(root, 'business', 'c.md', header('id: B-3\ntitle: Peso\nseverity: menor\napplies_to: src/**'));
      const result = await loadRules(root);
      expect(result.rules.map((item) => item.severity)).toEqual(['critical', 'major', 'minor']);
      expect(result.rules[0].keywords).toEqual(['precio', 'total']);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('requires applies_to outside policies and defaults empty policies to all files', async () => {
    const root = await project();
    try {
      await rule(root, 'rules', 'missing.md', header('id: R\ntitle: Missing\nseverity: major'));
      await rule(root, 'policies', 'all.md', header('id: P\ntitle: All\nseverity: critical\napplies_to: []'));
      await rule(root, 'policies', 'empty.md', header('id: P-2\ntitle: Empty\nseverity: major\napplies_to: ""'));
      const result = await loadRules(root);
      expect(result.problems).toContainEqual({ level: 'error', file: `${CONFIG_DIR}/rules/missing.md`, message: 'applies_to is required outside policies/' });
      expect(result.rules.map((item) => item.appliesTo)).toEqual([['**'], ['**']]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('trims severity whitespace and matches values without regard to case', async () => {
    const root = await project();
    try {
      await rule(root, 'rules', 'spaced.md', header('id: R\ntitle: Spaced\nseverity: " Critical "\napplies_to: src/**'));
      const result = await loadRules(root);
      expect(result.rules[0]?.severity).toBe('critical');
      expect(result.problems).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('lists accepted severity values for an unknown severity', async () => {
    const root = await project();
    try {
      await rule(root, 'rules', 'unknown.md', header('id: R\ntitle: Unknown\nseverity: urgent\napplies_to: src/**'));
      const result = await loadRules(root);
      expect(result.problems[0]?.message).toBe('severity must be one of: critical, major, minor, grave, importante, menor');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('requires a missing severity value', async () => {
    const root = await project();
    try {
      await rule(root, 'rules', 'missing.md', header('id: R\ntitle: Missing\napplies_to: src/**'));
      const result = await loadRules(root);
      expect(result.problems).toContainEqual({ level: 'error', file: `${CONFIG_DIR}/rules/missing.md`, message: 'severity is required' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('sorts problems by file and preserves detection order within each file', async () => {
    const root = await project();
    try {
      await rule(root, 'rules', 'a.md', header('id: A\ntitle: A\nseverity: urgent\napplies_to: 7'));
      await rule(root, 'rules', 'b.md', header('id: B\ntitle: B\nseverity: urgent\napplies_to: 8'));
      await rule(root, 'rules', 'c.md', '---\nid: [broken\n---\n');
      await rule(root, 'business', 'd.md', header('severity: urgent'));
      const result = await loadRules(root);
      expect(result.problems.map((problem) => problem.file)).toEqual([
        `${CONFIG_DIR}/business/d.md`, `${CONFIG_DIR}/business/d.md`,
        `${CONFIG_DIR}/business/d.md`, `${CONFIG_DIR}/business/d.md`,
        `${CONFIG_DIR}/rules/a.md`, `${CONFIG_DIR}/rules/a.md`,
        `${CONFIG_DIR}/rules/b.md`, `${CONFIG_DIR}/rules/b.md`,
        `${CONFIG_DIR}/rules/c.md`,
      ]);
      expect(result.problems.filter((problem) => problem.file.endsWith('/d.md')).map((problem) => problem.message)).toEqual([
        'id is required', 'title is required',
        'severity must be one of: critical, major, minor, grave, importante, menor',
        'applies_to is required outside policies/',
      ]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('reports one missing-field error per field and excludes invalid rules', async () => {
    const root = await project();
    try {
      await rule(root, 'policies', 'broken.md', header('severity: critical'));
      const result = await loadRules(root);
      expect(result.rules).toEqual([]);
      expect(result.problems.filter((problem) => problem.level === 'error' && problem.file.endsWith('broken.md')).map((problem) => problem.message)).toEqual([
        'id is required', 'title is required',
      ]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('reports invalid values, unknown fields, and malformed headers without stopping other rules', async () => {
    const root = await project();
    try {
      await rule(root, 'rules', 'bad.md', header('id: R\ntitle: Bad\nseverity: urgent\napplies_to: 4\nseverty: major'));
      await rule(root, 'rules', 'broken.md', '---\nid: [oops\n---\n');
      await rule(root, 'rules', 'good.md', header('id: G\ntitle: Good\nseverity: minor\napplies_to: src/**'));
      const result = await loadRules(root);
      expect(result.rules.map((item) => item.id)).toEqual(['G']);
      expect(result.problems.some((problem) => problem.level === 'error' && problem.message.startsWith('Invalid YAML at line'))).toBe(true);
      expect(result.problems.some((problem) => problem.message === 'unknown field: severty' && problem.level === 'warning')).toBe(true);
      expect(result.problems.some((problem) => problem.message.includes('severity'))).toBe(true);
      expect(result.problems.some((problem) => problem.message.includes('applies_to'))).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('warns about unknown config fields and treats a missing rule directory as empty', async () => {
    const root = await project();
    try {
      await rule(root, 'policies', 'ok.md', header('id: P\ntitle: Policy\nseverity: critical\nextra: value'));
      const result = await loadRules(root);
      expect(result.rules).toHaveLength(1);
      expect(result.problems).toContainEqual({ level: 'warning', file: `${CONFIG_DIR}/policies/ok.md`, message: 'unknown field: extra' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('does not traverse a symlinked directory', async () => {
    const root = await project();
    const outside = await project();
    try {
      await rule(outside, 'rules', 'outside.md', header('id: X\ntitle: Outside\nseverity: major\napplies_to: src/**'));
      await mkdir(join(root, CONFIG_DIR, 'rules'), { recursive: true });
      await symlink(join(outside, CONFIG_DIR, 'rules'), join(root, CONFIG_DIR, 'rules', 'linked'));
      expect((await loadRules(root)).rules).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
