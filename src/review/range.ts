import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMatcher } from '../config/match.js';
import type { Config } from '../config/types.js';
import { runGit } from '../git/git.js';
import type {
  ChangedFile,
  ReviewRange,
  ReviewRangeErrorReason,
} from './types.js';

/** Reports failures when computing the review range. */
export class ReviewRangeError extends Error {
  readonly reason: ReviewRangeErrorReason;

  constructor(reason: ReviewRangeErrorReason, message: string) {
    super(message);
    this.name = 'ReviewRangeError';
    this.reason = reason;
  }
}

/** Resolves the base Git reference using configuration and standard defaults. */
export async function resolveBase(
  root: string,
  config: Config,
): Promise<{ ref: string; source: 'config' | 'origin-head' | 'main' | 'master' }> {
  if (config.baseBranch) {
    try {
      await runGit(root, ['rev-parse', '--verify', config.baseBranch]);
      return { ref: config.baseBranch, source: 'config' };
    } catch {
      throw new ReviewRangeError(
        'base-not-found',
        `base_branch "${config.baseBranch}" from config.md does not exist`,
      );
    }
  }

  try {
    const originHead = (await runGit(root, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])).trim();
    if (originHead && originHead !== 'origin/HEAD') {
      return { ref: originHead, source: 'origin-head' };
    }
  } catch {
    // origin/HEAD is not available or remote does not exist.
  }

  try {
    await runGit(root, ['rev-parse', '--verify', 'main']);
    return { ref: 'main', source: 'main' };
  } catch {
    // Local main branch does not exist.
  }

  try {
    await runGit(root, ['rev-parse', '--verify', 'master']);
    return { ref: 'master', source: 'master' };
  } catch {
    // Local master branch does not exist.
  }

  throw new ReviewRangeError(
    'base-not-found',
    'Cannot find a base branch (tried config, origin/HEAD, main, master). Set base_branch in config.md.',
  );
}

/** Computes the changed files, commits, and lines for a code review range. */
export async function computeRange(
  root: string,
  opts: { config: Config; since?: string; lastRunHead?: string },
): Promise<ReviewRange> {
  const isShallow = (await runGit(root, ['rev-parse', '--is-shallow-repository'])).trim();
  if (isShallow === 'true') {
    throw new ReviewRangeError(
      'shallow',
      'Repository is a shallow clone; run git fetch --unshallow to review',
    );
  }

  let headSha: string;
  try {
    headSha = (await runGit(root, ['rev-parse', '--verify', 'HEAD'])).trim();
  } catch {
    throw new ReviewRangeError('no-commits', 'Repository has no commits');
  }

  const currentRef = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  const currentBranch = currentRef === 'HEAD' ? null : currentRef;

  const base = await resolveBase(root, opts.config);

  const isBase = currentBranch !== null && (
    currentBranch === base.ref
    || currentBranch === base.ref.replace(/^origin\//, '')
  );

  let mode: 'branch' | 'unpushed' | 'since-run' | 'since-ref';
  let baseLabel: string;
  let baseSha: string;
  let diffSpec: string | null = null;
  let commitsSpec: string | null = null;

  if (opts.since !== undefined) {
    let sinceSha: string;
    try {
      sinceSha = (await runGit(root, ['rev-parse', '--verify', `${opts.since}^{commit}`])).trim();
    } catch {
      throw new ReviewRangeError('bad-ref', `Reference "${opts.since}" does not exist`);
    }
    mode = 'since-ref';
    baseLabel = opts.since;
    baseSha = (await runGit(root, ['merge-base', sinceSha, 'HEAD'])).trim();
    diffSpec = `${sinceSha}...HEAD`;
    commitsSpec = `${sinceSha}..HEAD`;
  } else if (isBase) {
    let upstreamRef: string | undefined;
    let upstreamSha: string | undefined;
    try {
      upstreamRef = (await runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])).trim();
      upstreamSha = (await runGit(root, ['rev-parse', '--verify', '@{u}'])).trim();
    } catch {
      // No upstream configured.
    }

    const numstatHead = await runGit(root, ['diff', '--numstat', '-z', 'HEAD']);
    const untracked = await runGit(root, ['ls-files', '--others', '--exclude-standard', '-z']);
    const hasUncommitted = numstatHead.trim().length > 0 || untracked.trim().length > 0;

    let unpushedCount = 0;
    if (upstreamRef && upstreamSha) {
      const unpushedCommitsRaw = await runGit(root, ['log', '--format=%H%x00%s', `${upstreamRef}..HEAD`]);
      unpushedCount = parseCommits(unpushedCommitsRaw).length;
    }

    if (upstreamRef && upstreamSha && (unpushedCount > 0 || hasUncommitted)) {
      mode = 'unpushed';
      baseLabel = upstreamRef;
      baseSha = (await runGit(root, ['merge-base', upstreamRef, 'HEAD'])).trim();
      diffSpec = `${upstreamRef}...HEAD`;
      commitsSpec = `${upstreamRef}..HEAD`;
    } else if (opts.lastRunHead !== undefined) {
      let lastRunSha: string;
      try {
        lastRunSha = (await runGit(root, ['rev-parse', '--verify', `${opts.lastRunHead}^{commit}`])).trim();
      } catch {
        throw new ReviewRangeError('bad-ref', `Reference "${opts.lastRunHead}" does not exist`);
      }
      mode = 'since-run';
      baseLabel = opts.lastRunHead;
      baseSha = (await runGit(root, ['merge-base', lastRunSha, 'HEAD'])).trim();
      diffSpec = `${lastRunSha}...HEAD`;
      commitsSpec = `${lastRunSha}..HEAD`;
    } else if (!upstreamRef && hasUncommitted) {
      mode = 'unpushed';
      baseLabel = 'HEAD';
      baseSha = headSha;
      diffSpec = null;
      commitsSpec = null;
    } else {
      throw new ReviewRangeError(
        'needs-start',
        'Working directly on base branch with no upstream changes; specify --since <ref> to choose a starting point',
      );
    }
  } else {
    mode = 'branch';
    baseLabel = base.ref;
    baseSha = (await runGit(root, ['merge-base', base.ref, 'HEAD'])).trim();
    diffSpec = `${base.ref}...HEAD`;
    commitsSpec = `${base.ref}..HEAD`;
  }

  const commits = commitsSpec !== null
    ? parseCommits(await runGit(root, ['log', '--format=%H%x00%s', commitsSpec]))
    : [];

  const [committedNumstat, committedNameStatus, uncommittedNumstat, uncommittedNameStatus, untrackedOutput] =
    await Promise.all([
      diffSpec !== null ? runGit(root, ['diff', '--numstat', '-z', '-M', diffSpec]) : Promise.resolve(''),
      diffSpec !== null ? runGit(root, ['diff', '--name-status', '-z', '-M', diffSpec]) : Promise.resolve(''),
      runGit(root, ['diff', '--numstat', '-z', '-M', 'HEAD']),
      runGit(root, ['diff', '--name-status', '-z', '-M', 'HEAD']),
      runGit(root, ['ls-files', '--others', '--exclude-standard', '-z']),
    ]);

  const filesMap = new Map<string, ChangedFile>();

  const committedEntries = parseNumstat(committedNumstat);
  const committedStatus = parseNameStatus(committedNameStatus);
  for (const entry of committedEntries) {
    const info = committedStatus.get(entry.path);
    filesMap.set(entry.path, {
      path: entry.path,
      oldPath: info?.oldPath ?? entry.oldPath,
      status: info?.status ?? (entry.oldPath ? 'renamed' : entry.added > 0 && entry.removed === 0 ? 'added' : 'modified'),
      added: entry.added,
      removed: entry.removed,
      binary: entry.binary,
      committed: true,
      uncommitted: false,
    });
  }

  const uncommittedEntries = parseNumstat(uncommittedNumstat);
  const uncommittedStatus = parseNameStatus(uncommittedNameStatus);
  for (const entry of uncommittedEntries) {
    const info = uncommittedStatus.get(entry.path);
    const existing = filesMap.get(entry.path);
    if (existing) {
      existing.uncommitted = true;
      existing.added += entry.added;
      existing.removed += entry.removed;
      if (entry.binary) existing.binary = true;
      if (info?.status === 'deleted') existing.status = 'deleted';
    } else {
      filesMap.set(entry.path, {
        path: entry.path,
        oldPath: info?.oldPath ?? entry.oldPath,
        status: info?.status ?? (entry.oldPath ? 'renamed' : entry.added > 0 && entry.removed === 0 ? 'added' : 'modified'),
        added: entry.added,
        removed: entry.removed,
        binary: entry.binary,
        committed: false,
        uncommitted: true,
      });
    }
  }

  const untrackedTokens = untrackedOutput.split('\0').filter(Boolean);
  for (const untrackedPath of untrackedTokens) {
    if (filesMap.has(untrackedPath)) continue;
    const fullPath = join(root, untrackedPath);
    let isBinary = false;
    let lines = 0;
    try {
      const buffer = await readFile(fullPath);
      isBinary = buffer.includes(0);
      lines = isBinary ? 0 : countFileLines(buffer.toString('utf8'));
    } catch {
      continue;
    }
    filesMap.set(untrackedPath, {
      path: untrackedPath,
      status: 'added',
      added: lines,
      removed: 0,
      binary: isBinary,
      committed: false,
      uncommitted: true,
    });
  }

  const ignoreMatcher = createMatcher(opts.config.ignore);
  const sortedCandidateFiles = Array.from(filesMap.values()).sort((a, b) => compareText(a.path, b.path));

  const files: ChangedFile[] = [];
  const ignoredByConfig: string[] = [];

  for (const file of sortedCandidateFiles) {
    if (ignoreMatcher(file.path) !== undefined) {
      ignoredByConfig.push(file.path);
    } else {
      files.push(file);
    }
  }

  if (files.length === 0) {
    throw new ReviewRangeError('empty', 'The review range has no changed files');
  }

  const totalAdded = files.reduce((sum, f) => sum + (f.binary ? 0 : f.added), 0);
  const totalRemoved = files.reduce((sum, f) => sum + (f.binary ? 0 : f.removed), 0);
  const large = (totalAdded + totalRemoved) > opts.config.maxChangedLines;

  return {
    mode,
    branch: currentBranch,
    baseLabel,
    baseSha,
    headSha,
    commits,
    files,
    ignoredByConfig,
    added: totalAdded,
    removed: totalRemoved,
    large,
  };
}

/** Parses null-delimited numstat output from Git diff into structured change records. */
function parseNumstat(
  output: string,
): { path: string; oldPath?: string; added: number; removed: number; binary: boolean }[] {
  if (!output) return [];
  const tokens = output.split('\0');
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') tokens.pop();
  const results: { path: string; oldPath?: string; added: number; removed: number; binary: boolean }[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index++];
    if (!token) continue;
    const tabParts = token.split('\t');
    if (tabParts.length >= 3) {
      const addedStr = tabParts[0]!;
      const removedStr = tabParts[1]!;
      const binary = addedStr === '-' || removedStr === '-';
      const added = binary ? 0 : Number(addedStr);
      const removed = binary ? 0 : Number(removedStr);
      let path = tabParts.slice(2).join('\t');
      let oldPath: string | undefined;
      if (path === '') {
        oldPath = tokens[index++];
        path = tokens[index++] ?? '';
      }
      results.push({ path, oldPath, added, removed, binary });
    }
  }
  return results;
}

/** Parses null-delimited name-status output from Git diff into a path lookup map. */
function parseNameStatus(
  output: string,
): Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; oldPath?: string }> {
  const map = new Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; oldPath?: string }>();
  if (!output) return map;
  const tokens = output.split('\0');
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') tokens.pop();
  let index = 0;
  while (index < tokens.length) {
    const code = tokens[index++];
    if (!code) break;
    if (code.startsWith('R') || code.startsWith('C')) {
      const oldPath = tokens[index++];
      const newPath = tokens[index++];
      if (newPath) {
        map.set(newPath, { status: 'renamed', oldPath });
      }
    } else {
      const path = tokens[index++];
      if (path) {
        const status = code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified';
        map.set(path, { status });
      }
    }
  }
  return map;
}

/** Parses newline-separated commit log lines containing null-separated sha and subject. */
function parseCommits(output: string): { sha: string; subject: string }[] {
  const lines = output.split('\n').filter((line) => line.trim() !== '');
  return lines.map((line) => {
    const nullIdx = line.indexOf('\0');
    if (nullIdx === -1) {
      return { sha: line.trim(), subject: '' };
    }
    return {
      sha: line.slice(0, nullIdx),
      subject: line.slice(nullIdx + 1),
    };
  });
}

/** Counts all lines in text while ignoring a trailing newline. */
function countFileLines(content: string): number {
  if (content.length === 0) return 0;
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length;
}

/** Compares strings by Unicode code units for deterministic ordering. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
