import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runGit } from '../git/git.js';
import type { ReviewRange } from './types.js';

/** Detailed line-level additions and removals for a changed file. */
export interface ChangedLines {
  path: string;
  added: { line: number; text: string }[];
  removed: string[];
}

/** Parses raw unified diff output (-U0) into added and removed lines. */
function parseDiff(diffOutput: string): { added: { line: number; text: string }[]; removed: string[] } {
  const added: { line: number; text: string }[] = [];
  const removed: string[] = [];
  if (!diffOutput) {
    return { added, removed };
  }

  const rawLines = diffOutput.split('\n');
  let inHunk = false;
  let seenHunk = false;
  let currentLine = 0;

  for (const raw of rawLines) {
    const line = raw.replace(/\r$/, '');

    if (!seenHunk && line.startsWith('Binary files ')) {
      return { added: [], removed: [] };
    }

    if (line.startsWith('diff --git ')) {
      inHunk = false;
      continue;
    }

    if (line.startsWith('@@')) {
      seenHunk = true;
      inHunk = true;
      const match = line.match(/^@@\s+-[0-9]+(?:,[0-9]+)?\s+\+([0-9]+)(?:,[0-9]+)?\s+@@/);
      if (match) {
        currentLine = parseInt(match[1]!, 10);
      }
      continue;
    }

    if (!inHunk) {
      continue;
    }

    if (line.startsWith('\\')) {
      continue;
    }

    if (line.startsWith('+')) {
      added.push({ line: currentLine, text: line.slice(1) });
      currentLine++;
    } else if (line.startsWith('-')) {
      removed.push(line.slice(1));
    }
  }

  return { added, removed };
}

/** Reads all lines from an untracked file as newly added lines. */
async function readUntrackedFile(root: string, relativePath: string): Promise<ChangedLines> {
  const fullPath = join(root, relativePath);
  try {
    const content = await readFile(fullPath, 'utf8');
    if (content.length === 0) {
      return { path: relativePath, added: [], removed: [] };
    }
    const lines = content.split(/\r?\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    const added = lines.map((text, index) => ({
      line: index + 1,
      text: text.replace(/\r$/, ''),
    }));
    return { path: relativePath, added, removed: [] };
  } catch {
    return { path: relativePath, added: [], removed: [] };
  }
}

/** Reads changed lines for every file in a review range using unified diffs against the working tree. */
export async function readChangedLines(root: string, range: ReviewRange): Promise<ChangedLines[]> {
  const results: ChangedLines[] = [];

  for (const file of range.files) {
    if (file.binary) {
      results.push({ path: file.path, added: [], removed: [] });
      continue;
    }

    if (!file.committed && file.status !== 'deleted') {
      const tracked = await runGit(root, ['ls-files', '--', `:(literal)${file.path}`]);
      if (tracked.trim().length === 0) {
        const untracked = await readUntrackedFile(root, file.path);
        results.push(untracked);
        continue;
      }
    }

    const args = file.status === 'renamed' && file.oldPath
      ? ['diff', '-U0', '-M', range.baseSha, '--', `:(literal)${file.oldPath}`, `:(literal)${file.path}`]
      : ['diff', '-U0', range.baseSha, '--', `:(literal)${file.path}`];

    const diffOutput = await runGit(root, args);
    const { added, removed } = parseDiff(diffOutput);
    results.push({ path: file.path, added, removed });
  }

  return results;
}
