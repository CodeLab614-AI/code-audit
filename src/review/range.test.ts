import { describe, expect, test } from 'bun:test';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { Config } from '../config/types.js';
import {
  createBareRepo,
  createRepo,
  commitRepo,
  removeRepo,
  writeRepoFile,
} from '../test-helpers/repo.js';
import { computeRange, resolveBase, ReviewRangeError } from './range.js';

const execFile = promisify(execFileCallback);

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    structureVersion: 1,
    language: 'en',
    ignore: [],
    maxChangedLines: 1000,
    ...overrides,
  };
}

describe('resolveBase', () => {
  test('uses config.baseBranch over origin/HEAD when configured', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', '1\n');
      await commitRepo(root, 'init');
      await execFile('git', ['checkout', '-b', 'develop'], { cwd: root });
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      const base = await resolveBase(root, testConfig({ baseBranch: 'develop' }));
      expect(base).toEqual({ ref: 'develop', source: 'config' });
    } finally {
      await removeRepo(root);
    }
  });

  test('falls back to main when no remote and no baseBranch is configured', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', '1\n');
      await commitRepo(root, 'init');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      const base = await resolveBase(root, testConfig());
      expect(base).toEqual({ ref: 'main', source: 'main' });
    } finally {
      await removeRepo(root);
    }
  });

  test('falls back to master when main does not exist', async () => {
    const root = await createRepo();
    try {
      await execFile('git', ['branch', '-m', 'main', 'master'], { cwd: root });
      await writeRepoFile(root, 'init.txt', '1\n');
      await commitRepo(root, 'init');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      const base = await resolveBase(root, testConfig());
      expect(base).toEqual({ ref: 'master', source: 'master' });
    } finally {
      await removeRepo(root);
    }
  });

  test('uses origin/HEAD when remote origin is configured with default branch', async () => {
    const remote = await createBareRepo();
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', '1\n');
      await commitRepo(root, 'init');
      await execFile('git', ['remote', 'add', 'origin', remote], { cwd: root });
      await execFile('git', ['push', '-u', 'origin', 'main'], { cwd: root });
      await execFile('git', ['remote', 'set-head', 'origin', 'main'], { cwd: root });
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      const base = await resolveBase(root, testConfig());
      expect(base).toEqual({ ref: 'origin/main', source: 'origin-head' });
    } finally {
      await removeRepo(root);
      await removeRepo(remote);
    }
  });

  test('throws base-not-found when none of config, origin/HEAD, main, or master exists', async () => {
    const root = await createRepo();
    try {
      await execFile('git', ['branch', '-m', 'main', 'production'], { cwd: root });
      await writeRepoFile(root, 'init.txt', '1\n');
      await commitRepo(root, 'init');

      let thrown: ReviewRangeError | undefined;
      try {
        await resolveBase(root, testConfig());
      } catch (error) {
        thrown = error as ReviewRangeError;
      }
      expect(thrown).toBeInstanceOf(ReviewRangeError);
      expect(thrown?.reason).toBe('base-not-found');
    } finally {
      await removeRepo(root);
    }
  });

  test('throws base-not-found when config.baseBranch does not exist or is invalid', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', '1\n');
      await commitRepo(root, 'init');

      let thrownDevelop: ReviewRangeError | undefined;
      try {
        await resolveBase(root, testConfig({ baseBranch: 'develop' }));
      } catch (error) {
        thrownDevelop = error as ReviewRangeError;
      }
      expect(thrownDevelop).toBeInstanceOf(ReviewRangeError);
      expect(thrownDevelop?.reason).toBe('base-not-found');
      expect(thrownDevelop?.message).toBe('base_branch "develop" from config.md does not exist');

      let thrownDashP: ReviewRangeError | undefined;
      try {
        await resolveBase(root, testConfig({ baseBranch: '-p' }));
      } catch (error) {
        thrownDashP = error as ReviewRangeError;
      }
      expect(thrownDashP).toBeInstanceOf(ReviewRangeError);
      expect(thrownDashP?.reason).toBe('base-not-found');
      expect(thrownDashP?.message).toBe('base_branch "-p" from config.md does not exist');
    } finally {
      await removeRepo(root);
    }
  });
});

describe('computeRange', () => {
  test('returns branch mode with commits and uncommitted modified file', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'existing.txt', 'line 1\n');
      await commitRepo(root, 'base commit');

      await execFile('git', ['checkout', '-b', 'feat/range-test'], { cwd: root });
      await writeRepoFile(root, 'file1.txt', 'commit 1\n');
      await commitRepo(root, 'first branch commit');
      await writeRepoFile(root, 'file2.txt', 'commit 2\n');
      await commitRepo(root, 'second branch commit');

      await writeRepoFile(root, 'file1.txt', 'commit 1\nuncommitted line\n');

      const range = await computeRange(root, { config: testConfig() });
      expect(range.mode).toBe('branch');
      expect(range.branch).toBe('feat/range-test');
      expect(range.commits).toHaveLength(2);
      expect(range.commits[0]?.subject).toBe('second branch commit');
      expect(range.commits[1]?.subject).toBe('first branch commit');

      const file1 = range.files.find((f) => f.path === 'file1.txt');
      expect(file1).toBeDefined();
      expect(file1?.committed).toBe(true);
      expect(file1?.uncommitted).toBe(true);

      const file2 = range.files.find((f) => f.path === 'file2.txt');
      expect(file2?.committed).toBe(true);
      expect(file2?.uncommitted).toBe(false);
    } finally {
      await removeRepo(root);
    }
  });

  test('handles renamed file with changes preserving oldPath', async () => {
    const root = await createRepo();
    try {
      let content = '';
      for (let i = 0; i < 20; i += 1) content += `line ${i}\n`;
      await writeRepoFile(root, 'original.txt', content);
      await commitRepo(root, 'add original');

      await execFile('git', ['checkout', '-b', 'feat/rename'], { cwd: root });
      await execFile('git', ['mv', 'original.txt', 'renamed.txt'], { cwd: root });
      await writeRepoFile(root, 'renamed.txt', `${content}extra line\n`);
      await commitRepo(root, 'rename and modify');

      const range = await computeRange(root, { config: testConfig() });
      const renamed = range.files.find((f) => f.path === 'renamed.txt');
      expect(renamed).toBeDefined();
      expect(renamed?.status).toBe('renamed');
      expect(renamed?.oldPath).toBe('original.txt');
      expect(renamed?.added).toBe(1);
    } finally {
      await removeRepo(root);
    }
  });

  test('handles deleted file and binary file with zero counted lines', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'to-delete.txt', 'line 1\nline 2\n');
      await writeFile(join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3, 255]));
      await commitRepo(root, 'base commit');

      await execFile('git', ['checkout', '-b', 'feat/del-bin'], { cwd: root });
      await execFile('git', ['rm', 'to-delete.txt'], { cwd: root });
      await writeFile(join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3, 4, 5, 255]));
      await commitRepo(root, 'delete and change binary');

      const range = await computeRange(root, { config: testConfig() });
      const deleted = range.files.find((f) => f.path === 'to-delete.txt');
      expect(deleted?.status).toBe('deleted');
      expect(deleted?.removed).toBe(2);

      const binary = range.files.find((f) => f.path === 'binary.bin');
      expect(binary?.binary).toBe(true);
      expect(binary?.added).toBe(0);
      expect(binary?.removed).toBe(0);
    } finally {
      await removeRepo(root);
    }
  });

  test('preserves difficult filenames such as untracked "nuevo ñ.ts" and "[x].ts"', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');

      await execFile('git', ['checkout', '-b', 'feat/difficult-names'], { cwd: root });
      await writeRepoFile(root, '[x].ts', 'export const x = 1;\n');
      await commitRepo(root, 'commit [x].ts');

      await writeRepoFile(root, 'nuevo ñ.ts', 'console.log("ñ");\nconsole.log("dos");\n');

      const range = await computeRange(root, { config: testConfig() });
      const bracketFile = range.files.find((f) => f.path === '[x].ts');
      expect(bracketFile).toBeDefined();
      expect(bracketFile?.path).toBe('[x].ts');

      const untrackedFile = range.files.find((f) => f.path === 'nuevo ñ.ts');
      expect(untrackedFile).toBeDefined();
      expect(untrackedFile?.path).toBe('nuevo ñ.ts');
      expect(untrackedFile?.status).toBe('added');
      expect(untrackedFile?.uncommitted).toBe(true);
      expect(untrackedFile?.committed).toBe(false);
      expect(untrackedFile?.added).toBe(2);
    } finally {
      await removeRepo(root);
    }
  });

  test('filters files matching config.ignore and records them in ignoredByConfig', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');

      await execFile('git', ['checkout', '-b', 'feat/ignore'], { cwd: root });
      await writeRepoFile(root, 'src/main.ts', 'console.log(1);\n');
      await writeRepoFile(root, 'dist/bundle.js', 'bundled code\n');
      await commitRepo(root, 'add files');

      const config = testConfig({ ignore: ['dist/**'] });
      const range = await computeRange(root, { config });

      expect(range.files.some((f) => f.path === 'dist/bundle.js')).toBe(false);
      expect(range.files.some((f) => f.path === 'src/main.ts')).toBe(true);
      expect(range.ignoredByConfig).toContain('dist/bundle.js');
    } finally {
      await removeRepo(root);
    }
  });

  test('reports needs-start on base with no upstream and no since/lastRunHead, and since-run when lastRunHead is given', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file1.txt', '1\n');
      await commitRepo(root, 'c1');
      const firstHead = (await execFile('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();

      await writeRepoFile(root, 'file2.txt', '2\n');
      await commitRepo(root, 'c2');

      let thrown: ReviewRangeError | undefined;
      try {
        await computeRange(root, { config: testConfig() });
      } catch (error) {
        thrown = error as ReviewRangeError;
      }
      expect(thrown).toBeInstanceOf(ReviewRangeError);
      expect(thrown?.reason).toBe('needs-start');

      const rangeSinceRun = await computeRange(root, {
        config: testConfig(),
        lastRunHead: firstHead,
      });
      expect(rangeSinceRun.mode).toBe('since-run');
      expect(rangeSinceRun.baseSha).toBe(firstHead);
      expect(rangeSinceRun.files.some((f) => f.path === 'file2.txt')).toBe(true);
    } finally {
      await removeRepo(root);
    }
  });

  test('throws bad-ref when since option references a non-existent ref', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');

      let thrown: ReviewRangeError | undefined;
      try {
        await computeRange(root, { config: testConfig(), since: 'nope' });
      } catch (error) {
        thrown = error as ReviewRangeError;
      }
      expect(thrown).toBeInstanceOf(ReviewRangeError);
      expect(thrown?.reason).toBe('bad-ref');
    } finally {
      await removeRepo(root);
    }
  });

  test('throws empty when branch has no changes against base', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');
      await execFile('git', ['checkout', '-b', 'feat/empty'], { cwd: root });

      let thrown: ReviewRangeError | undefined;
      try {
        await computeRange(root, { config: testConfig() });
      } catch (error) {
        thrown = error as ReviewRangeError;
      }
      expect(thrown).toBeInstanceOf(ReviewRangeError);
      expect(thrown?.reason).toBe('empty');
    } finally {
      await removeRepo(root);
    }
  });

  test('throws no-commits when repository has no commits', async () => {
    const root = await createRepo();
    try {
      let thrown: ReviewRangeError | undefined;
      try {
        await computeRange(root, { config: testConfig() });
      } catch (error) {
        thrown = error as ReviewRangeError;
      }
      expect(thrown).toBeInstanceOf(ReviewRangeError);
      expect(thrown?.reason).toBe('no-commits');
    } finally {
      await removeRepo(root);
    }
  });

  test('throws shallow when repository is a shallow clone', async () => {
    const origin = await createRepo();
    const shallow = `${origin}-shallow`;
    try {
      await writeRepoFile(origin, 'a.txt', '1\n');
      await commitRepo(origin, 'c1');
      await writeRepoFile(origin, 'b.txt', '2\n');
      await commitRepo(origin, 'c2');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: origin });
      await writeRepoFile(origin, 'c.txt', '3\n');
      await commitRepo(origin, 'c3');

      await execFile('git', ['clone', '--depth', '1', '--branch', 'feat', `file://${origin}`, shallow]);

      let thrown: ReviewRangeError | undefined;
      try {
        await computeRange(shallow, { config: testConfig() });
      } catch (error) {
        thrown = error as ReviewRangeError;
      }
      expect(thrown).toBeInstanceOf(ReviewRangeError);
      expect(thrown?.reason).toBe('shallow');
    } finally {
      await removeRepo(origin);
      await removeRepo(shallow);
    }
  });

  test('sets large to true when changed lines exceed maxChangedLines', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');

      await execFile('git', ['checkout', '-b', 'feat/large'], { cwd: root });
      await writeRepoFile(root, 'lines.txt', '1\n2\n3\n4\n5\n');
      await commitRepo(root, '5 lines added');

      const config = testConfig({ maxChangedLines: 3 });
      const range = await computeRange(root, { config });
      expect(range.added).toBe(5);
      expect(range.large).toBe(true);
    } finally {
      await removeRepo(root);
    }
  });

  test('supports detached HEAD treating it like a branch with null branch name', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');

      await execFile('git', ['checkout', '-b', 'temp-branch'], { cwd: root });
      await writeRepoFile(root, 'feature.txt', 'feature\n');
      await commitRepo(root, 'feature commit');
      const headSha = (await execFile('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
      await execFile('git', ['checkout', headSha], { cwd: root });

      const range = await computeRange(root, { config: testConfig() });
      expect(range.mode).toBe('branch');
      expect(range.branch).toBeNull();
      expect(range.commits).toHaveLength(1);
    } finally {
      await removeRepo(root);
    }
  });

  test('supports unpushed mode on base branch with upstream and unpushed commits', async () => {
    const remote = await createBareRepo();
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');
      await execFile('git', ['remote', 'add', 'origin', remote], { cwd: root });
      await execFile('git', ['push', '-u', 'origin', 'main'], { cwd: root });

      await writeRepoFile(root, 'unpushed.txt', 'unpushed line\n');
      await commitRepo(root, 'unpushed commit');

      const range = await computeRange(root, { config: testConfig() });
      expect(range.mode).toBe('unpushed');
      expect(range.commits).toHaveLength(1);
      expect(range.commits[0]?.subject).toBe('unpushed commit');
      expect(range.files.some((f) => f.path === 'unpushed.txt')).toBe(true);
    } finally {
      await removeRepo(root);
      await removeRepo(remote);
    }
  });

  test('does not report remote commits fetched into upstream as deleted files', async () => {
    const remote = await createBareRepo();
    const alice = await createRepo();
    const bob = await createRepo();
    try {
      await writeRepoFile(alice, 'init.txt', 'init\n');
      await commitRepo(alice, 'initial commit');
      await execFile('git', ['remote', 'add', 'origin', remote], { cwd: alice });
      await execFile('git', ['push', '-u', 'origin', 'main'], { cwd: alice });

      await execFile('git', ['remote', 'add', 'origin', remote], { cwd: bob });
      await execFile('git', ['fetch', 'origin'], { cwd: bob });
      await execFile('git', ['checkout', '-b', 'main', '--track', 'origin/main'], { cwd: bob });

      // Bob makes 1 local commit on main.
      await writeRepoFile(bob, 'local.ts', 'export const local = true;\n');
      await commitRepo(bob, 'local change');

      // Alice makes 1 commit and pushes to origin/main.
      await writeRepoFile(alice, 'remoto.ts', 'export const remote = true;\n');
      await commitRepo(alice, 'remote change from alice');
      await execFile('git', ['push', 'origin', 'main'], { cwd: alice });

      // Bob fetches from origin without merging or rebasing.
      await execFile('git', ['fetch', 'origin', 'main'], { cwd: bob });

      const range = await computeRange(bob, { config: testConfig() });
      expect(range.mode).toBe('unpushed');
      expect(range.files).toHaveLength(1);
      expect(range.files[0]?.path).toBe('local.ts');
      expect(range.files[0]?.status).toBe('added');
      expect(range.commits).toHaveLength(1);
      expect(range.commits[0]?.subject).toBe('local change');
    } finally {
      await removeRepo(bob);
      await removeRepo(alice);
      await removeRepo(remote);
    }
  });

  test('supports unpushed mode on base branch with no upstream and uncommitted changes', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.txt', 'initial\n');
      await commitRepo(root, 'init');

      // 1. Modified tracked file.
      await writeRepoFile(root, 'file.txt', 'initial\nmodified\n');

      const rangeModified = await computeRange(root, { config: testConfig() });
      expect(rangeModified.mode).toBe('unpushed');
      expect(rangeModified.baseLabel).toBe('HEAD');
      expect(rangeModified.commits).toHaveLength(0);
      expect(rangeModified.files).toHaveLength(1);
      expect(rangeModified.files[0]?.path).toBe('file.txt');
      expect(rangeModified.files[0]?.status).toBe('modified');
      expect(rangeModified.files[0]?.uncommitted).toBe(true);

      // 2. Add an untracked file as well.
      await writeRepoFile(root, 'untracked.ts', 'const a = 1;\n');

      const rangeWithUntracked = await computeRange(root, { config: testConfig() });
      expect(rangeWithUntracked.mode).toBe('unpushed');
      expect(rangeWithUntracked.baseLabel).toBe('HEAD');
      expect(rangeWithUntracked.commits).toHaveLength(0);
      expect(rangeWithUntracked.files).toHaveLength(2);
      expect(rangeWithUntracked.files.some((f) => f.path === 'untracked.ts')).toBe(true);
    } finally {
      await removeRepo(root);
    }
  });

  test('supports since-run mode on base branch with no upstream when commits and uncommitted changes exist after lastRunHead', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'init.txt', 'init\n');
      await commitRepo(root, 'init');
      const lastRunHead = (await execFile('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();

      await writeRepoFile(root, 'a.ts', 'console.log("a");\n');
      await commitRepo(root, 'add a.ts');

      await writeRepoFile(root, 'b.ts', 'console.log("b");\n');

      // Without lastRunHead, it gives unpushed with base HEAD and only uncommitted b.ts
      const rangeWithoutLastRun = await computeRange(root, { config: testConfig() });
      expect(rangeWithoutLastRun.mode).toBe('unpushed');
      expect(rangeWithoutLastRun.baseLabel).toBe('HEAD');
      expect(rangeWithoutLastRun.commits).toHaveLength(0);
      expect(rangeWithoutLastRun.files).toHaveLength(1);
      expect(rangeWithoutLastRun.files[0]?.path).toBe('b.ts');

      // With lastRunHead, it gives since-run, the commit of a.ts in commits, and a.ts and b.ts in files
      const rangeWithLastRun = await computeRange(root, { config: testConfig(), lastRunHead });
      expect(rangeWithLastRun.mode).toBe('since-run');
      expect(rangeWithLastRun.baseLabel).toBe(lastRunHead);
      expect(rangeWithLastRun.commits).toHaveLength(1);
      expect(rangeWithLastRun.commits[0]?.subject).toBe('add a.ts');
      expect(rangeWithLastRun.files.map((f) => f.path).sort()).toEqual(['a.ts', 'b.ts']);
      expect(rangeWithLastRun.files.find((f) => f.path === 'a.ts')?.committed).toBe(true);
      expect(rangeWithLastRun.files.find((f) => f.path === 'b.ts')?.uncommitted).toBe(true);
    } finally {
      await removeRepo(root);
    }
  });
});
