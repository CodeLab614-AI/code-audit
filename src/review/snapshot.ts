import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG_DIR } from '../config/paths.js';
import { runGit } from '../git/git.js';

/** Represents a lightweight cryptographic and structural snapshot of a repository. */
export interface Snapshot {
  head: string;
  branch: string | null;
  index: string;
  files: Record<string, string>;
}

/** Represents a single detected difference between two repository snapshots. */
export type SnapshotChange =
  | { kind: 'head' | 'branch' | 'index' }
  | { kind: 'added' | 'removed' | 'modified'; path: string };

/** Takes a snapshot of Git HEAD, current branch, index state, and non-ignored files. */
export async function takeSnapshot(root: string): Promise<Snapshot> {
  const head = (await runGit(root, ['rev-parse', '--verify', 'HEAD'])).trim();

  const currentRef = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  const branch = currentRef === 'HEAD' ? null : currentRef;

  const stageOutput = await runGit(root, ['ls-files', '--stage', '-z']);
  const index = createHash('sha256').update(stageOutput).digest('hex');

  const rawFiles = await runGit(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
  const tokens = rawFiles.split('\0').filter((token) => token.length > 0);

  const runsPrefix = `${CONFIG_DIR}/runs/`;
  const uniquePaths = new Set<string>();

  for (const token of tokens) {
    const normalized = token.endsWith('/') ? token.slice(0, -1) : token;
    if (!normalized) continue;
    if (normalized === `${CONFIG_DIR}/runs` || normalized.startsWith(runsPrefix)) continue;
    uniquePaths.add(normalized);
  }

  const sortedPaths = Array.from(uniquePaths).sort(compareText);
  const files: Record<string, string> = {};

  for (const path of sortedPaths) {
    const fullPath = join(root, path);
    try {
      const stat = await lstat(fullPath);
      if (stat.isSymbolicLink()) {
        try {
          const target = await readlink(fullPath);
          files[path] = `link:${target}`;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ENOENT' || code === 'ENOTDIR') {
            files[path] = 'missing';
          } else {
            throw error;
          }
        }
      } else if (stat.isDirectory()) {
        files[path] = 'dir';
      } else {
        try {
          files[path] = await hashFileStream(fullPath);
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ENOENT' || code === 'ENOTDIR') {
            files[path] = 'missing';
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        files[path] = 'missing';
      } else {
        throw error;
      }
    }
  }

  return { head, branch, index, files };
}

/** Compares two snapshots and returns ordered differences in Git and file states. */
export function compareSnapshots(before: Snapshot, after: Snapshot): SnapshotChange[] {
  const changes: SnapshotChange[] = [];

  if (before.head !== after.head) {
    changes.push({ kind: 'head' });
  }

  if (before.branch !== after.branch) {
    changes.push({ kind: 'branch' });
  }

  if (before.index !== after.index) {
    changes.push({ kind: 'index' });
  }

  const allPaths = new Set<string>([
    ...Object.keys(before.files),
    ...Object.keys(after.files),
  ]);
  const sortedPaths = Array.from(allPaths).sort(compareText);

  const added: SnapshotChange[] = [];
  const removed: SnapshotChange[] = [];
  const modified: SnapshotChange[] = [];

  for (const path of sortedPaths) {
    const valBefore = before.files[path];
    const valAfter = after.files[path];

    const existsBefore = valBefore !== undefined && valBefore !== 'missing';
    const existsAfter = valAfter !== undefined && valAfter !== 'missing';

    if (!existsBefore && existsAfter) {
      added.push({ kind: 'added', path });
    } else if (existsBefore && !existsAfter) {
      removed.push({ kind: 'removed', path });
    } else if (existsBefore && existsAfter && valBefore !== valAfter) {
      modified.push({ kind: 'modified', path });
    }
  }

  return [
    ...changes,
    ...added,
    ...removed,
    ...modified,
  ];
}

/** Computes the SHA-256 hexadecimal hash of a file by streaming its content in chunks. */
async function hashFileStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/** Compares strings by Unicode code units for deterministic ordering. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
