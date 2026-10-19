import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_DIR } from './paths.js';
import { loadConfig } from './config.js';

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'code-audit-config-'));
  await mkdir(join(root, CONFIG_DIR), { recursive: true });
  return root;
}

async function config(root: string, text: string): Promise<void> {
  await writeFile(join(root, CONFIG_DIR, 'config.md'), text);
}

describe('loadConfig', () => {
  it('returns defaults and a not-found error when config.md is missing', async () => {
    const root = await project();
    try {
      const result = await loadConfig(root);
      expect(result.config).toEqual({ structureVersion: 1, language: 'en', ignore: [], maxChangedLines: 1000 });
      expect(result.problems).toContainEqual({ level: 'error', file: `${CONFIG_DIR}/config.md`, message: 'config.md not found' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('returns an independent ignore list for each missing config', async () => {
    const root = await project();
    try {
      const first = await loadConfig(root);
      first.config.ignore.push('local/**');
      expect((await loadConfig(root)).config.ignore).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('reports an unsupported structure version', async () => {
    const root = await project();
    try {
      await config(root, '---\nstructure_version: 2\n---\n');
      const result = await loadConfig(root);
      expect(result.problems.some((problem) => problem.level === 'error' && problem.message.includes('1'))).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects the agent field with the exact planned message', async () => {
    const root = await project();
    try {
      await config(root, '---\nagent: claude\n---\n');
      expect((await loadConfig(root)).problems).toContainEqual({ level: 'error', file: `${CONFIG_DIR}/config.md`, message: 'agent must not be set: the agent that launches code-audit is always used' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects zero and nonnumeric max_changed_lines', async () => {
    const root = await project();
    try {
      await config(root, '---\nmax_changed_lines: 0\n---\n');
      const zero = await loadConfig(root);
      expect(zero.problems.some((problem) => problem.level === 'error' && problem.message.includes('max_changed_lines'))).toBe(true);
      await config(root, '---\nmax_changed_lines: many\n---\n');
      const text = await loadConfig(root);
      expect(text.problems.some((problem) => problem.level === 'error' && problem.message.includes('max_changed_lines'))).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('normalizes valid config values and warns on unknown fields', async () => {
    const root = await project();
    try {
      await config(root, '---\nstructure_version: 1\nlanguage: es\nbase_branch: main\nignore: [vendor/**]\nmax_changed_lines: 250\nlangauge: typo\n---\n');
      const result = await loadConfig(root);
      expect(result.config).toEqual({ structureVersion: 1, language: 'es', baseBranch: 'main', ignore: ['vendor/**'], maxChangedLines: 250 });
      expect(result.problems).toContainEqual({ level: 'warning', file: `${CONFIG_DIR}/config.md`, message: 'unknown field: langauge' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
