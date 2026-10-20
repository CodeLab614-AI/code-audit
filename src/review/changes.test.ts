import { describe, expect, test } from 'bun:test';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { Config } from '../config/types.js';
import {
  createRepo,
  commitRepo,
  removeRepo,
  writeRepoFile,
} from '../test-helpers/repo.js';
import { computeRange } from './range.js';
import { readChangedLines } from './changes.js';

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

describe('readChangedLines', () => {
  test('single changed line on line 2 returns added line and removed text', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'file.ts', 'line1\nline2\nline3\n');
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });
      await writeRepoFile(root, 'file.ts', 'line1\nline2 edited\nline3\n');
      await commitRepo(root, 'edit line 2');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'file.ts',
        added: [{ line: 2, text: 'line2 edited' }],
        removed: ['line2'],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('mixture of committed change and uncommitted edit gives line numbers of current version', async () => {
    const root = await createRepo();
    try {
      const initialContent = Array.from({ length: 10 }, (_, i) => `${i + 1}`).join('\n') + '\n';
      await writeRepoFile(root, 'mixed.ts', initialContent);
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      // Commit 1: change line 5 from "5" to "5 edited"
      const commitContent = Array.from({ length: 10 }, (_, i) => (i === 4 ? '5 edited' : `${i + 1}`)).join('\n') + '\n';
      await writeRepoFile(root, 'mixed.ts', commitContent);
      await commitRepo(root, 'edit line 5');

      // Uncommitted: add line "0" at the top before line 1
      const uncommittedContent = '0\n' + commitContent;
      await writeRepoFile(root, 'mixed.ts', uncommittedContent);

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]!.path).toBe('mixed.ts');
      // In current version:
      // Line 1 is "0" (uncommitted addition at top)
      // Line 6 is "5 edited" (previously line 5 in commit, now shifted to line 6)
      expect(changes[0]!.added).toEqual([
        { line: 1, text: '0' },
        { line: 6, text: '5 edited' },
      ]);
      expect(changes[0]!.removed).toEqual(['5']);
    } finally {
      await removeRepo(root);
    }
  });

  test('line endings: CRLF strips trailing \\r and file without final newline counts last line', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'crlf.ts', 'line1\r\nline2\r\nline3');
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      await writeRepoFile(root, 'crlf.ts', 'line1\r\nline2 edited\r\nline3 edited');
      await commitRepo(root, 'edit without final newline and with CRLF');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]!.path).toBe('crlf.ts');
      expect(changes[0]!.added).toEqual([
        { line: 2, text: 'line2 edited' },
        { line: 3, text: 'line3 edited' },
      ]);
      expect(changes[0]!.removed).toEqual(['line2', 'line3']);
      // Ensure no \r remains in any added or removed line
      for (const item of changes[0]!.added) {
        expect(item.text.includes('\r')).toBe(false);
      }
      for (const item of changes[0]!.removed) {
        expect(item.includes('\r')).toBe(false);
      }
    } finally {
      await removeRepo(root);
    }
  });

  test('difficult filename: *.ts does not include lines from other .ts files', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, '*.ts', 'star1\nstar2\nstar3\n');
      await writeRepoFile(root, 'other.ts', 'other1\nother2\nother3\n');
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      await writeRepoFile(root, '*.ts', 'star1\nstar2 edited\nstar3\n');
      await commitRepo(root, 'edit *.ts only');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: '*.ts',
        added: [{ line: 2, text: 'star2 edited' }],
        removed: ['star2'],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('renamed file with one change returns only changed line not whole file', async () => {
    const root = await createRepo();
    try {
      const initialLines = 'line1\nline2\nline3\nline4\nline5\nline6\n';
      await writeRepoFile(root, 'original.ts', initialLines);
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      await execFile('git', ['mv', 'original.ts', 'renamed.ts'], { cwd: root });
      await writeRepoFile(root, 'renamed.ts', 'line1\nline2\nline3 edited\nline4\nline5\nline6\n');
      await commitRepo(root, 'rename and edit one line');

      const range = await computeRange(root, { config: testConfig() });
      expect(range.files[0]?.status).toBe('renamed');

      const changes = await readChangedLines(root, range);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'renamed.ts',
        added: [{ line: 3, text: 'line3 edited' }],
        removed: ['line3'],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('untracked file with non-ASCII name returns all lines as added with lines 1, 2, 3', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'base.txt', 'base\n');
      await commitRepo(root, 'initial');

      await writeRepoFile(root, 'nuevo ñ.ts', 'primera\nsegunda\ntercera\n');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      const enyeChanges = changes.find((c) => c.path === 'nuevo ñ.ts');
      expect(enyeChanges).toBeDefined();
      expect(enyeChanges).toEqual({
        path: 'nuevo ñ.ts',
        added: [
          { line: 1, text: 'primera' },
          { line: 2, text: 'segunda' },
          { line: 3, text: 'tercera' },
        ],
        removed: [],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('deleted file has empty added and all lines in removed', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'to-delete.txt', 'first line\nsecond line\n');
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      await execFile('git', ['rm', 'to-delete.txt'], { cwd: root });
      await commitRepo(root, 'delete file');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'to-delete.txt',
        added: [],
        removed: ['first line', 'second line'],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('binary file returns empty lists for added and removed', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'image.png', 'header\0binary\0data');
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      await writeRepoFile(root, 'image.png', 'header\0binary\0modified\0data');
      await commitRepo(root, 'update binary');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'image.png',
        added: [],
        removed: [],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('text file mentioning Binary files retains added line', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'doc.md', '# Documentation\n');
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      await writeRepoFile(root, 'doc.md', '# Documentation\nBinary files a.png and b.png differ\n');
      await commitRepo(root, 'add binary files mention');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'doc.md',
        added: [{ line: 2, text: 'Binary files a.png and b.png differ' }],
        removed: [],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('SQL comment removal and line addition starting with ++ are parsed as content', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'query.sql', 'SELECT 1;\n-- comentario\nSELECT 2;\n');
      await commitRepo(root, 'initial');
      await execFile('git', ['checkout', '-b', 'feat'], { cwd: root });

      await writeRepoFile(root, 'query.sql', 'SELECT 1;\n++c++\nSELECT 2;\n');
      await commitRepo(root, 'replace sql comment with ++c++');

      const range = await computeRange(root, { config: testConfig() });
      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'query.sql',
        added: [{ line: 2, text: '++c++' }],
        removed: ['-- comentario'],
      });
    } finally {
      await removeRepo(root);
    }
  });

  test('unpushed mode on base branch with HEAD base only reflects uncommitted changes', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'main.ts', 'line1\nline2\nline3\n');
      await commitRepo(root, 'initial');

      // Working directly on main, edit line 2 without commit
      await writeRepoFile(root, 'main.ts', 'line1\nline2 uncommitted\nline3\n');

      const range = await computeRange(root, { config: testConfig() });
      expect(range.mode).toBe('unpushed');
      expect(range.baseLabel).toBe('HEAD');

      const changes = await readChangedLines(root, range);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'main.ts',
        added: [{ line: 2, text: 'line2 uncommitted' }],
        removed: ['line2'],
      });
    } finally {
      await removeRepo(root);
    }
  });
});
