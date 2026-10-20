/** Describes a file changed within a review range. */
export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  added: number;
  removed: number;
  binary: boolean;
  committed: boolean;
  uncommitted: boolean;
}

/** Specific failure reasons why a review range could not be computed. */
export type ReviewRangeErrorReason =
  | 'empty'
  | 'base-not-found'
  | 'shallow'
  | 'needs-start'
  | 'bad-ref'
  | 'no-commits';

/** Computed scope and changed files for a code review. */
export interface ReviewRange {
  mode: 'branch' | 'unpushed' | 'since-run' | 'since-ref';
  branch: string | null;
  baseLabel: string;
  baseSha: string;
  headSha: string;
  commits: { sha: string; subject: string }[];
  files: ChangedFile[];
  ignoredByConfig: string[];
  added: number;
  removed: number;
  large: boolean;
}
