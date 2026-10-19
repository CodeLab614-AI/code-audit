import { describe, expect, it } from 'bun:test';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  findRepoRoot, GitError, GitForbiddenError, NotARepoError, READ_ONLY_COMMANDS, runGit,
} from './git.js';
import { commitRepo, createBareRepo, createRepo, removeRepo, writeRepoFile } from '../test-helpers/repo.js';

const execFile = promisify(execFileCallback);

async function witness(root: string, name: string): Promise<string> {
  const file = join(root, `${name}.mjs`);
  await writeFile(file, `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(join(root, name))}, 'ran');\n`);
  return file;
}

describe('runGit', () => {
  it('exports the exact read-only command allowlist', () => {
    expect(READ_ONLY_COMMANDS).toEqual([
      'diff', 'log', 'show', 'status', 'rev-parse', 'merge-base', 'ls-files', 'cat-file', 'grep', 'blame',
    ]);
  });

  it('rejects missing subcommands, global options, and every write command before execution', async () => {
    const root = await createRepo();
    try {
      for (const args of [[], ['-c', 'x=y', 'status'], ['--git-dir=/tmp', 'status']]) {
        await expect(runGit(root, args)).rejects.toBeInstanceOf(GitForbiddenError);
      }
      for (const command of ['commit', 'push', 'merge', 'fetch', 'checkout', 'reset', 'stash', 'branch']) {
        await expect(runGit(root, [command, '-m', 'x'])).rejects.toBeInstanceOf(GitForbiddenError);
      }
    } finally { await removeRepo(root); }
  });

  it('blocks output options and abbreviations before they can create a file', async () => {
    const root = await createRepo();
    try {
      for (const args of [
        ['diff', '--out=x.txt'], ['diff', '--outp=x.txt'], ['diff', '--output=x.txt'],
        ['diff', '--output', 'x.txt'], ['diff', '--', '--output=x.txt'],
      ]) await expect(runGit(root, args)).rejects.toBeInstanceOf(GitForbiddenError);
      expect(await Bun.file(join(root, 'x.txt')).exists()).toBe(false);
    } finally { await removeRepo(root); }
  });

  it('blocks grep pager and textconv abbreviations, filters, and short option groups', async () => {
    const root = await createRepo();
    try {
      for (const args of [
        ['grep', '-O', 'foo'], ['grep', '-iO', 'foo'], ['grep', '-Ovim', 'foo'],
        ['grep', '--open', 'foo'], ['grep', '--open=program', 'foo'], ['grep', '--textc', 'foo'],
        ['cat-file', '--filters', 'HEAD:a.txt'],
        ['log', '-o', 'x'], ['show', '-vo', 'x'], ['diff', '-o=x'],
      ]) await expect(runGit(root, args)).rejects.toBeInstanceOf(GitForbiddenError);
    } finally { await removeRepo(root); }
  });

  it('rejects pager programs and textconv abbreviations without running the witness', async () => {
    const root = await createRepo();
    try {
      const marker = await witness(root, 'forbidden-program-ran');
      await writeRepoFile(root, 'a', 'content');
      await commitRepo(root);
      await execFile('git', ['config', 'diff.witness.textconv', `${process.execPath} ${marker}`], { cwd: root });
      await writeRepoFile(root, '.gitattributes', 'a diff=witness\n');
      await commitRepo(root);
      await expect(runGit(root, ['grep', `--open=${marker}`, 'a'])).rejects.toBeInstanceOf(GitForbiddenError);
      await expect(runGit(root, ['grep', '--textc', 'a'])).rejects.toBeInstanceOf(GitForbiddenError);
      expect(await Bun.file(join(root, 'forbidden-program-ran')).exists()).toBe(false);
    } finally { await removeRepo(root); }
  });

  it('allows output-indicator options and arguments that are not dangerous prefixes', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'a.txt', 'old\n');
      await commitRepo(root);
      await writeRepoFile(root, 'a.txt', 'new\n');
      expect(await runGit(root, ['diff', '--output-indicator-new=+'])).toContain('+new');
    } finally { await removeRepo(root); }
  });

  it('neutralizes configured textconv for diff, log, show, and blame', async () => {
    const root = await createRepo();
    try {
      const marker = await witness(root, 'textconv-ran');
      await writeRepoFile(root, 'a.txt', 'first\n');
      await commitRepo(root, 'first');
      await execFile('git', ['config', 'diff.witness.textconv', `${process.execPath} ${marker}`], { cwd: root });
      await writeRepoFile(root, '.gitattributes', 'a.txt diff=witness\n');
      await writeRepoFile(root, 'a.txt', 'second\n');
      await commitRepo(root, 'second');

      await runGit(root, ['diff', 'HEAD~1']);
      await runGit(root, ['log', '-p', '-1']);
      await runGit(root, ['show', 'HEAD']);
      await runGit(root, ['blame', 'a.txt']);
      expect(await Bun.file(join(root, 'textconv-ran')).exists()).toBe(false);
    } finally { await removeRepo(root); }
  });

  it('neutralizes a configured external diff program', async () => {
    const root = await createRepo();
    try {
      const marker = await witness(root, 'external-diff-ran');
      await writeRepoFile(root, 'a.txt', 'first\n');
      await commitRepo(root, 'first');
      await execFile('git', ['config', 'diff.external', `${process.execPath} ${marker}`], { cwd: root });
      await writeRepoFile(root, 'a.txt', 'second\n');
      await runGit(root, ['diff', 'HEAD']);
      expect(await Bun.file(join(root, 'external-diff-ran')).exists()).toBe(false);
    } finally { await removeRepo(root); }
  });

  it('ignores inherited GIT_* variables and disables optional index locks', async () => {
    const root = await createRepo();
    const other = await createRepo();
    const previous = process.env.GIT_DIR;
    try {
      await writeRepoFile(root, 'here.txt', 'here');
      await writeRepoFile(other, 'there.txt', 'there');
      await commitRepo(root);
      await commitRepo(other);
      process.env.GIT_DIR = join(other, '.git');
      expect(await runGit(root, ['ls-files'])).toBe('here.txt\n');
    } finally {
      if (previous === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previous;
      await removeRepo(root);
      await removeRepo(other);
    }
  });

  it('keeps status from refreshing an existing stale index', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'tracked.txt', 'one');
      await commitRepo(root);
      const index = join(root, '.git', 'index');
      await writeRepoFile(root, 'tracked.txt', 'two');
      const old = new Date(Date.now() - 120_000);
      await import('node:fs/promises').then(({ utimes }) => utimes(index, old, old));
      const before = (await stat(index)).mtimeMs;
      await runGit(root, ['status']);
      expect((await stat(index)).mtimeMs).toBe(before);
    } finally { await removeRepo(root); }
  });

  it('returns an empty string for grep with no matches', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'a.txt', 'present');
      await commitRepo(root);
      expect(await runGit(root, ['grep', 'absent'])).toBe('');
    } finally { await removeRepo(root); }
  });

  it('returns unescaped UTF-8 filenames and handles repository paths with spaces and accents', async () => {
    const base = await mkdtemp(join(tmpdir(), 'code-audit Mis Proyectos tienda-'));
    const root = join(base, 'Mis Proyectos', 'tienda ñ');
    try {
      await (await import('node:fs/promises')).mkdir(root, { recursive: true });
      await execFile('git', ['-c', 'init.defaultBranch=main', 'init'], { cwd: root });
      await execFile('git', ['config', 'user.name', 'Code Audit Tests'], { cwd: root });
      await execFile('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: root });
      await writeRepoFile(root, 'años.txt', 'sí\n');
      await commitRepo(root);
      expect(await findRepoRoot(root)).toBe(await realpath(root));
      expect(await runGit(root, ['ls-files'])).toBe('años.txt\n');
    } finally { await rm(base, { recursive: true, force: true }); }
  });

  it('reports Git failures with exit code and stderr', async () => {
    const root = await createRepo();
    try {
      await expect(runGit(root, ['rev-parse', 'HEAD'])).rejects.toMatchObject({
        constructor: GitError, exitCode: 128, stderr: expect.stringContaining('HEAD'),
      });
    } finally { await removeRepo(root); }
  });

  it('reports a clear error when Git is unavailable', async () => {
    const root = await createRepo();
    const previous = process.env.PATH;
    try {
      process.env.PATH = '/nonexistent';
      await expect(runGit(root, ['status'])).rejects.toMatchObject({
        constructor: GitError, message: 'git is not installed or not in PATH',
      });
      await expect(findRepoRoot(root)).rejects.toMatchObject({
        constructor: NotARepoError, message: 'Git is not installed or not in PATH',
      });
    } finally {
      if (previous === undefined) delete process.env.PATH;
      else process.env.PATH = previous;
      await removeRepo(root);
    }
  });

  it('settles commands that would otherwise wait for standard input', async () => {
    const root = await createRepo();
    try {
      const calls = [runGit(root, ['cat-file', '--batch']), runGit(root, ['grep', '-f', '-'])];
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Git command did not settle within five seconds')), 4_900);
      });
      try {
        const results = await Promise.race([Promise.allSettled(calls), timeout]);
        expect(results).toHaveLength(2);
        for (const result of results) {
          if (result.status === 'fulfilled') expect(result.value).toBe('');
          else expect(result.reason).toBeInstanceOf(GitError);
        }
      } finally { clearTimeout(timer!); }
    } finally { await removeRepo(root); }
  });

  it('reports a missing or non-directory working path as a directory error', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'code-audit-missing-root-'));
    const missing = join(parent, 'missing');
    const file = join(parent, 'file');
    await writeFile(file, 'not a directory');
    try {
      for (const cwd of [missing, file]) {
        const message = `directory does not exist: ${cwd}`;
        await expect(runGit(cwd, ['status'])).rejects.toMatchObject({ message });
        await expect(findRepoRoot(cwd)).rejects.toMatchObject({ message });
      }
    } finally { await rm(parent, { recursive: true, force: true }); }
  });

  it('honors a small maxBuffer override and reports a GitError', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'a.txt', 'fixture');
      await commitRepo(root);
      await expect(runGit(root, ['log', '--format=%H'], { maxBuffer: 10 })).rejects.toMatchObject({
        constructor: GitError, message: expect.stringContaining('git output exceeded'),
      });
    } finally { await removeRepo(root); }
  });

  it('keeps conservative blocks while allowing safe rev-parse alternatives', async () => {
    const root = await createRepo();
    try {
      await expect(runGit(root, ['rev-parse', '--git-dir'])).rejects.toBeInstanceOf(GitForbiddenError);
      await expect(runGit(root, ['grep', '-c', 'pattern'])).rejects.toBeInstanceOf(GitForbiddenError);
      await expect(runGit(root, ['diff', '-c'])).rejects.toBeInstanceOf(GitForbiddenError);
      expect((await runGit(root, ['rev-parse', '--absolute-git-dir'])).trim()).toContain('.git');
      expect((await runGit(root, ['rev-parse', '--show-toplevel'])).trim()).toBe(await realpath(root));
    } finally { await removeRepo(root); }
  });

  it.skipIf(process.platform !== 'win32')('ignores inherited Git variables regardless of casing on Windows', async () => {
    const root = await createRepo();
    const other = await createRepo();
    const previous = process.env.Git_Dir;
    try {
      await writeRepoFile(root, 'here.txt', 'here');
      await writeRepoFile(other, 'there.txt', 'there');
      await commitRepo(root);
      await commitRepo(other);
      process.env.Git_Dir = join(other, '.git');
      expect(await runGit(root, ['ls-files'])).toBe('here.txt\n');
    } finally {
      if (previous === undefined) delete process.env.Git_Dir;
      else process.env.Git_Dir = previous;
      await removeRepo(root);
      await removeRepo(other);
    }
  });
});

describe('findRepoRoot', () => {
  it('returns the repository root from a nested directory', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'nested/deeper/file.txt', 'x');
      expect(await findRepoRoot(join(root, 'nested', 'deeper'))).toBe(await realpath(root));
    } finally { await removeRepo(root); }
  });

  it('rejects a non-repository, a bare repository, and a path inside .git', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'code-audit-outside-'));
    const bare = await createBareRepo();
    const root = await createRepo();
    try {
      await expect(findRepoRoot(outside)).rejects.toBeInstanceOf(NotARepoError);
      await expect(findRepoRoot(bare)).rejects.toBeInstanceOf(NotARepoError);
      await expect(findRepoRoot(join(root, '.git'))).rejects.toBeInstanceOf(NotARepoError);
    } finally {
      await rm(outside, { recursive: true, force: true });
      await removeRepo(bare);
      await removeRepo(root);
    }
  });
});
