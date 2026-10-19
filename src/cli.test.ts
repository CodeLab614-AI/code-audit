import { describe, expect, it } from 'bun:test';
import { main } from '../src/cli.js';
import { VERSION } from '../src/version.js';
import { ExitCode } from '../src/exit-codes.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRepo, removeRepo, writeRepoFile } from './test-helpers/repo.js';
import { initProject } from './init/init.js';

describe('CLI', () => {
  it('prints the version and returns success', async () => {
    const stdout: string[] = [];
    const code = await main(['--version'], { stdout: (s) => stdout.push(s), stderr: () => {} });

    expect(code).toBe(ExitCode.OK);
    expect(stdout.join('')).toContain(VERSION);
  });

  it('prints help with the available commands', async () => {
    const stdout: string[] = [];
    const code = await main(['--help'], { stdout: (s) => stdout.push(s), stderr: () => {} });

    expect(code).toBe(ExitCode.OK);
    expect(stdout.join('')).toContain('init');
    expect(stdout.join('')).toContain('check');
    expect(stdout.join('')).toContain('review');
  });

  it('rejects unknown commands', async () => {
    const stderr: string[] = [];
    const code = await main(['nope'], { stdout: () => {}, stderr: (s) => stderr.push(s) });

    expect(code).toBe(ExitCode.USAGE);
    expect(stderr.join('')).toContain('Unknown command: nope');
  });

  it('reports that review is not available yet', async () => {
    const stderr: string[] = [];
    const code = await main(['review'], { stdout: () => {}, stderr: (s) => stderr.push(s) });

    expect(code).toBe(ExitCode.USAGE);
    expect(stderr.join('')).toContain('review is not available yet');
  });

  it('checks the discovered repo root and returns config errors in plain output', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'en' });
      await writeRepoFile(root, '.agents/code-audit/rules/z.md', '---\nid: SAME\ntitle: Z\nseverity: minor\napplies_to: ["**"]\n---\nZ\n');
      await writeRepoFile(root, '.agents/code-audit/rules/a.md', '---\nid: same\ntitle: A\nseverity: minor\napplies_to: ["**"]\n---\nA\n');
      await writeRepoFile(root, '.agents/code-audit/rules/m.md', '---\nid: MATCH\ntitle: M\nseverity: minor\napplies_to: ["missing/**"]\n---\nM\n');
      await writeRepoFile(root, '.agents/code-audit/rules/n.md', '---\nid: NO-SEVERITY\ntitle: N\napplies_to: ["**"]\n---\nN\n');
      const stdout: string[] = [];
      const stderr: string[] = [];
      const code = await main(['check', '--root', root], { stdout: (s) => stdout.push(s), stderr: (s) => stderr.push(s) });
      expect(code).toBe(ExitCode.CONFIG_INVALID);
      expect(stderr.join('')).toBe('');
      expect(stdout.join('')).toContain('error   .agents/code-audit/rules/z.md: duplicate rule id "SAME" also appears in .agents/code-audit/rules/a.md as "same"');
      expect(stdout.join('')).toContain('error   .agents/code-audit/rules/n.md: severity is required');
      expect(stdout.join('')).toContain('warning .agents/code-audit/rules/m.md: applies_to pattern matches no file: missing/**');
      expect(stdout.join('')).toContain('3 rules (0 policies). 2 errors, 1 warning.');
    } finally { await removeRepo(root); }
  });

  it('prints the complete check result as JSON and returns success for warnings only', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'en' });
      await writeRepoFile(root, '.agents/code-audit/rules/m.md', '---\nid: M\ntitle: M\nseverity: minor\napplies_to: ["missing/**"]\n---\nM\n');
      const stdout: string[] = [];
      const code = await main(['check', '--root', root, '--json'], { stdout: (s) => stdout.push(s), stderr: () => {} });
      expect(code).toBe(ExitCode.OK);
      expect(JSON.parse(stdout.join(''))).toEqual({
        problems: [{ level: 'warning', file: '.agents/code-audit/rules/m.md', message: 'applies_to pattern matches no file: missing/**' }],
        ruleCount: 1,
        policyCount: 0,
      });
      const plain: string[] = [];
      const plainCode = await main(['check', '--root', root], { stdout: (s) => plain.push(s), stderr: () => {} });
      expect(plainCode).toBe(ExitCode.OK);
      expect(plain.join('')).toBe('warning .agents/code-audit/rules/m.md: applies_to pattern matches no file: missing/**\n1 rule (0 policies). 0 errors, 1 warning.\n');
    } finally { await removeRepo(root); }
  });

  it('returns code 3 when check runs outside a Git repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'code-audit-not-repo-'));
    try {
      const stderr: string[] = [];
      const code = await main(['check', '--root', root], { stdout: () => {}, stderr: (s) => stderr.push(s) });
      expect(code).toBe(ExitCode.NOT_A_REPO);
      expect(stderr.join('')).toContain('not a working Git repository');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
