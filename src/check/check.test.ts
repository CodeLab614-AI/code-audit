import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { checkProject } from './check.js';
import { initProject } from '../init/init.js';
import { createRepo, removeRepo, writeRepoFile } from '../test-helpers/repo.js';

const execFile = promisify(execFileCallback);

function rule(id: string, options: { applies?: string; severity?: string; body?: string } = {}): string {
  return `---\nid: ${id}\ntitle: ${id}\n${options.severity === undefined ? 'severity: minor\n' : options.severity}\n${options.applies === undefined ? 'applies_to: ["src/**"]\n' : `applies_to: ["${options.applies}"]\n`}---\n${options.body ?? 'Rule body.'}\n`;
}

async function addRule(root: string, file: string, content: string): Promise<void> {
  await writeRepoFile(root, `.agents/code-audit/rules/${file}`, content);
}

describe('checkProject', () => {
  it('accepts a fresh init in both languages without errors or warnings', async () => {
    for (const language of ['en', 'es']) {
      const root = await createRepo();
      try {
        await initProject(root, { language });
        const result = await checkProject(root);
        expect(result.problems.filter((problem) => problem.level === 'error' || problem.level === 'warning')).toEqual([]);
        expect(result.ruleCount).toBe(0);
        expect(result.policyCount).toBe(0);
      } finally { await removeRepo(root); }
    }
  });

  it('preserves the spelling of ids when case-insensitive duplicates differ', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'en' });
      await addRule(root, 'a.md', rule('biz-003', { applies: '**' }));
      await addRule(root, 'b.md', rule('BIZ-003', { applies: '**' }));
      const result = await checkProject(root);
      expect(result.problems).toContainEqual({
        level: 'error', file: '.agents/code-audit/rules/b.md',
        message: 'duplicate rule id "BIZ-003" also appears in .agents/code-audit/rules/a.md as "biz-003"',
      });
    } finally { await removeRepo(root); }
  });

  it('omits the second spelling when duplicate ids are identical', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'en' });
      await addRule(root, 'a.md', rule('BIZ-003', { applies: '**' }));
      await addRule(root, 'b.md', rule('BIZ-003', { applies: '**' }));
      expect((await checkProject(root)).problems).toContainEqual({
        level: 'error', file: '.agents/code-audit/rules/b.md',
        message: 'duplicate rule id "BIZ-003" also appears in .agents/code-audit/rules/a.md',
      });
    } finally { await removeRepo(root); }
  });

  it('matches tracked and untracked files, excludes ignored files, and handles unusual names', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'code-audit-spaces-'));
    const root = join(parent, 'Mis Proyectos', 'tienda ñ');
    try {
      await mkdir(root, { recursive: true });
      await execFile('git', ['-c', 'init.defaultBranch=main', 'init'], { cwd: root });
      await execFile('git', ['config', 'user.name', 'Code Audit Tests'], { cwd: root });
      await execFile('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: root });
      await initProject(root, { language: 'en' });
      await writeRepoFile(root, '.gitignore', 'ignored.ts\n');
      await writeRepoFile(root, 'años.ts', 'export {};\n');
      await writeRepoFile(root, 'untracked.ts', 'export {};\n');
      await writeRepoFile(root, 'ignored.ts', 'export {};\n');
      await addRule(root, 'match.md', rule('MATCH', { applies: '**/años.ts' }));
      await addRule(root, 'untracked.md', rule('UNTRACKED', { applies: 'untracked.ts' }));
      await addRule(root, 'ignored.md', rule('IGNORED', { applies: 'ignored.ts' }));
      await addRule(root, 'newline.md', rule('NEWLINE', { applies: '**/strange*' }));
      await writeRepoFile(root, 'strange name\n.ts', 'export {};\n');
      const result = await checkProject(root);
      expect(result.problems.filter((problem) => problem.message.startsWith('applies_to pattern matches no file:')))
        .toEqual([{ level: 'warning', file: '.agents/code-audit/rules/ignored.md', message: 'applies_to pattern matches no file: ignored.ts' }]);
    } finally { await rm(parent, { recursive: true, force: true }); }
  });

  it('warns for every unmatched applies_to pattern', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'en' });
      await addRule(root, 'missing.md', rule('MISSING', { applies: 'src/absent.ts' }));
      expect((await checkProject(root)).problems).toContainEqual({
        level: 'warning', file: '.agents/code-audit/rules/missing.md',
        message: 'applies_to pattern matches no file: src/absent.ts',
      });
    } finally { await removeRepo(root); }
  });

  it('warns after the policy threshold and counts policies in the total', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'en' });
      for (let index = 0; index < 16; index += 1) {
        await writeRepoFile(root, `.agents/code-audit/policies/p${index}.md`, `---\nid: P-${index}\ntitle: P-${index}\nseverity: minor\n---\nPolicy.\n`);
      }
      const result = await checkProject(root);
      expect(result.ruleCount).toBe(16);
      expect(result.policyCount).toBe(16);
      expect(result.problems).toContainEqual({ level: 'warning', file: '.agents/code-audit/policies', message: 'policies/ has 16 rules; they are read on every review, keep them few' });
    } finally { await removeRepo(root); }
  });

  it('returns config and rule loading errors together in file order', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'en' });
      await writeRepoFile(root, '.agents/code-audit/config.md', '---\nstructure_version: nope\n---\n');
      await addRule(root, 'broken.md', 'not a frontmatter file');
      const result = await checkProject(root);
      expect(result.problems.some((problem) => problem.file.endsWith('config.md') && problem.level === 'error')).toBe(true);
      expect(result.problems.some((problem) => problem.file.endsWith('broken.md') && problem.level === 'error')).toBe(true);
      expect(result.problems.map((problem) => problem.file)).toEqual([...result.problems.map((problem) => problem.file)].sort());
    } finally { await removeRepo(root); }
  });
});
