import { describe, expect, test } from 'bun:test';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, rm, symlink, unlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { CONFIG_DIR } from '../config/paths.js';
import {
  createRepo,
  commitRepo,
  removeRepo,
  writeRepoFile,
} from '../test-helpers/repo.js';
import {
  compareSnapshots,
  takeSnapshot,
  type Snapshot,
  type SnapshotChange,
} from './snapshot.js';

const execFile = promisify(execFileCallback);

describe('takeSnapshot and compareSnapshots', () => {
  test('two consecutive snapshots without changes return an empty list', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'const a = 1;\n');
      await commitRepo(root, 'initial');

      const s1 = await takeSnapshot(root);
      const s2 = await takeSnapshot(root);

      expect(compareSnapshots(s1, s2)).toEqual([]);
    } finally {
      await removeRepo(root);
    }
  });

  test('editing a file returns modified', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'const a = 1;\n');
      await commitRepo(root, 'initial');

      const s1 = await takeSnapshot(root);
      await writeRepoFile(root, 'file.ts', 'const a = 2;\n');
      const s2 = await takeSnapshot(root);

      expect(compareSnapshots(s1, s2)).toEqual([
        { kind: 'modified', path: 'file.ts' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('creating a new file returns added', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'const a = 1;\n');
      await commitRepo(root, 'initial');

      const s1 = await takeSnapshot(root);
      await writeRepoFile(root, 'new-file.ts', 'export const b = 2;\n');
      const s2 = await takeSnapshot(root);

      expect(compareSnapshots(s1, s2)).toEqual([
        { kind: 'added', path: 'new-file.ts' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('deleting a tracked file returns removed and records missing in the snapshot', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'tracked.ts', 'export const x = 1;\n');
      await commitRepo(root, 'initial');

      const s1 = await takeSnapshot(root);
      await unlink(join(root, 'tracked.ts'));
      const s2 = await takeSnapshot(root);

      expect(s2.files['tracked.ts']).toBe('missing');
      expect(compareSnapshots(s1, s2)).toEqual([
        { kind: 'removed', path: 'tracked.ts' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('git add of a file already edited before the first snapshot returns only index', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'initial\n');
      await commitRepo(root, 'initial');

      await writeRepoFile(root, 'file.ts', 'edited\n');
      const s1 = await takeSnapshot(root);

      await execFile('git', ['add', 'file.ts'], { cwd: root });
      const s2 = await takeSnapshot(root);

      expect(compareSnapshots(s1, s2)).toEqual([
        { kind: 'index' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('a commit returns head', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'initial\n');
      await commitRepo(root, 'initial');

      const s1 = await takeSnapshot(root);
      await writeRepoFile(root, 'file.ts', 'edited\n');
      await commitRepo(root, 'second commit');
      const s2 = await takeSnapshot(root);

      expect(compareSnapshots(s1, s2)).toEqual([
        { kind: 'head' },
        { kind: 'index' },
        { kind: 'modified', path: 'file.ts' },
      ]);

      // If we only commit without changing working tree beyond staged, compare reflects head
      const s3 = await takeSnapshot(root);
      await execFile('git', ['commit', '--allow-empty', '-m', 'empty commit'], { cwd: root });
      const s4 = await takeSnapshot(root);
      expect(compareSnapshots(s3, s4)).toEqual([
        { kind: 'head' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('touch without changing content returns an empty list', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'console.log("hello");\n');
      await commitRepo(root, 'initial');

      const s1 = await takeSnapshot(root);
      const past = new Date(Date.now() - 60000);
      await utimes(join(root, 'file.ts'), past, past);
      await execFile('git', ['status'], { cwd: root });
      const s2 = await takeSnapshot(root);

      expect(compareSnapshots(s1, s2)).toEqual([]);
    } finally {
      await removeRepo(root);
    }
  });

  test('writing in CONFIG_DIR/runs returns an empty list and is excluded from files', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'initial\n');
      await commitRepo(root, 'initial');

      const s1 = await takeSnapshot(root);
      await writeRepoFile(root, `${CONFIG_DIR}/runs/run-123/findings.json`, '{"test":true}');
      await writeRepoFile(root, `${CONFIG_DIR}/runs/run-123/informe.html`, '<h1>ok</h1>');
      const s2 = await takeSnapshot(root);

      expect(s2.files[`${CONFIG_DIR}/runs/run-123/findings.json`]).toBeUndefined();
      expect(s2.files[`${CONFIG_DIR}/runs/run-123/informe.html`]).toBeUndefined();
      expect(compareSnapshots(s1, s2)).toEqual([]);
    } finally {
      await removeRepo(root);
    }
  });

  test('replacing a tracked folder with a file with the same name reports added and removed', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'a/b.ts', 'export const b = 1;\n');
      await commitRepo(root, 'commit folder');

      const s1 = await takeSnapshot(root);
      await rm(join(root, 'a'), { recursive: true, force: true });
      await writeRepoFile(root, 'a', 'just a file\n');

      const s2 = await takeSnapshot(root);
      expect(s2.files['a/b.ts']).toBe('missing');
      expect(compareSnapshots(s1, s2)).toEqual([
        { kind: 'added', path: 'a' },
        { kind: 'removed', path: 'a/b.ts' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('symlink is recorded as link:<target> and changing target returns modified', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'target-a.txt', 'hello A\n');
      await writeRepoFile(root, 'target-b.txt', 'hello B\n');
      await symlink('target-a.txt', join(root, 'sym.txt'));
      await commitRepo(root, 'initial with symlink');

      const s1 = await takeSnapshot(root);
      expect(s1.files['sym.txt']).toBe('link:target-a.txt');

      await unlink(join(root, 'sym.txt'));
      await symlink('target-b.txt', join(root, 'sym.txt'));
      const s2 = await takeSnapshot(root);

      expect(s2.files['sym.txt']).toBe('link:target-b.txt');
      expect(compareSnapshots(s1, s2)).toEqual([
        { kind: 'modified', path: 'sym.txt' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('untracked nested git repository is stored with key nested and value dir', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'main.ts', 'export const a = 1;\n');
      await commitRepo(root, 'initial');

      const nestedRoot = join(root, 'nested');
      await mkdir(nestedRoot, { recursive: true });
      await execFile('git', ['init'], { cwd: nestedRoot });
      await writeRepoFile(nestedRoot, 'inner.ts', 'export const inner = 2;\n');

      const s = await takeSnapshot(root);
      expect(s.files['nested']).toBe('dir');
      expect(s.files['nested/']).toBeUndefined();
    } finally {
      await removeRepo(root);
    }
  });

  test('editing a file ignored by .gitignore returns an empty list', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, '.gitignore', 'ignored.txt\n');
      await writeRepoFile(root, 'main.ts', 'console.log("main");\n');
      await commitRepo(root, 'initial');

      await writeRepoFile(root, 'ignored.txt', 'initial ignored\n');
      const s1 = await takeSnapshot(root);
      expect(s1.files['ignored.txt']).toBeUndefined();

      await writeRepoFile(root, 'ignored.txt', 'modified ignored\n');
      const s2 = await takeSnapshot(root);

      expect(compareSnapshots(s1, s2)).toEqual([]);
    } finally {
      await removeRepo(root);
    }
  });

  test('switching branch on same commit yields only branch; detached HEAD yields branch: null', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'export const x = 1;\n');
      await commitRepo(root, 'initial');
      await execFile('git', ['branch', 'feat'], { cwd: root });

      const sMain = await takeSnapshot(root);
      expect(sMain.branch).toBe('main');

      await execFile('git', ['checkout', 'feat'], { cwd: root });
      const sFeat = await takeSnapshot(root);
      expect(sFeat.branch).toBe('feat');
      expect(compareSnapshots(sMain, sFeat)).toEqual([
        { kind: 'branch' },
      ]);

      await execFile('git', ['checkout', '--detach', 'HEAD'], { cwd: root });
      const sDetached = await takeSnapshot(root);
      expect(sDetached.branch).toBeNull();
      expect(compareSnapshots(sFeat, sDetached)).toEqual([
        { kind: 'branch' },
      ]);
    } finally {
      await removeRepo(root);
    }
  });

  test('difficult filenames *.ts, [x].ts, tab names, and spaces with accents are preserved exactly', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, '*.ts', 'asterisk\n');
      await writeRepoFile(root, '[x].ts', 'brackets\n');
      await writeRepoFile(root, 'file\tname.ts', 'tab\n');
      await writeRepoFile(root, 'Mis Proyectos/años ñ.ts', 'accents\n');
      await commitRepo(root, 'difficult names');

      const s = await takeSnapshot(root);
      expect(s.files['*.ts']).toBeDefined();
      expect(s.files['[x].ts']).toBeDefined();
      expect(s.files['file\tname.ts']).toBeDefined();
      expect(s.files['Mis Proyectos/años ñ.ts']).toBeDefined();
    } finally {
      await removeRepo(root);
    }
  });

  test('multiple simultaneous changes are ordered by head, branch, index, added, removed, modified with paths sorted', () => {
    const before: Snapshot = {
      head: '1111111',
      branch: 'main',
      index: 'aaaa',
      files: {
        'keep.ts': 'same',
        'mod-b.ts': 'hash-b-old',
        'mod-a.ts': 'hash-a-old',
        'rem-b.ts': 'hash-rb',
        'rem-a.ts': 'hash-ra',
      },
    };

    const after: Snapshot = {
      head: '2222222',
      branch: 'feature',
      index: 'bbbb',
      files: {
        'keep.ts': 'same',
        'mod-b.ts': 'hash-b-new',
        'mod-a.ts': 'hash-a-new',
        'add-b.ts': 'hash-ab',
        'add-a.ts': 'hash-aa',
        'rem-b.ts': 'missing',
      },
    };

    const changes = compareSnapshots(before, after);
    expect(changes).toEqual([
      { kind: 'head' },
      { kind: 'branch' },
      { kind: 'index' },
      { kind: 'added', path: 'add-a.ts' },
      { kind: 'added', path: 'add-b.ts' },
      { kind: 'removed', path: 'rem-a.ts' },
      { kind: 'removed', path: 'rem-b.ts' },
      { kind: 'modified', path: 'mod-a.ts' },
      { kind: 'modified', path: 'mod-b.ts' },
    ]);
  });
});
