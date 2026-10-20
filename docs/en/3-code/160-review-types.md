Part 3 · Page 20 of 28 · Previous: [Pattern matcher](150-config-match.md) · Next: [Review range](170-review-range.md) · [Index](../README.md)
# Review types

**File:** `src/review/types.ts` · 35 lines · **Status:** available

## Page index

- What is it and what is it for?
- Types
- Where it is used
- Tests

## What is it and what is it for?

This file defines the data structures representing changed files and the overall scope of a code review.

Without these typed definitions, range computation, rule selection, and reporting would have to pass unstructured objects without type-checking guarantees.

It defines the `ChangedFile` and `ReviewRange` interfaces, and the `ReviewRangeErrorReason` union type. It is used by [`src/review/range.ts`](170-review-range.md).

## Types

```ts
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
```

### `ChangedFile`

Represents a modified, added, deleted, or renamed file within the review scope.

#### `path` — `string`

- **Required or default:** required.
- **Purpose:** Repository-relative file path using forward slashes (`/`).
- **Values:** Non-empty string indicating current path.
- **Populated by:** `src/review/range.ts:168`, `src/review/range.ts:186`, `src/review/range.ts:210`.
- **Read by:** `src/review/range.ts:203`.
- **Example:** `'src/main.ts'`.

#### `oldPath` — `string | undefined`

- **Required or default:** optional.
- **Purpose:** Tracks prior path when a file has been renamed.
- **Values:** String path when `status` is `'renamed'`; otherwise, `undefined`.
- **Populated by:** `src/review/range.ts:169`, `src/review/range.ts:187`.
- **Read by:** Report generators and diff citation verifiers.
- **Example:** `'src/old-main.ts'`.

#### `status` — `'added' | 'modified' | 'deleted' | 'renamed'`

- **Required or default:** required.
- **Purpose:** Change category of the file relative to the review base.
- **Values:** `'added'`, `'modified'`, `'deleted'`, or `'renamed'`.
- **Populated by:** `src/review/range.ts:170`, `src/review/range.ts:188`, `src/review/range.ts:211`.
- **Read by:** Rule filters and reporting templates.
- **Example:** `'modified'`.

#### `added` — `number`

- **Required or default:** required.
- **Purpose:** Number of added lines in the file (zero for binary files).
- **Values:** Integer greater than or equal to zero.
- **Populated by:** `src/review/range.ts:171`, `src/review/range.ts:189`, `src/review/range.ts:212`.
- **Read by:** `src/review/range.ts:221`.
- **Example:** `15`.

#### `removed` — `number`

- **Required or default:** required.
- **Purpose:** Number of removed lines in the file (zero for binary files).
- **Values:** Integer greater than or equal to zero.
- **Populated by:** `src/review/range.ts:172`, `src/review/range.ts:190`, `src/review/range.ts:213`.
- **Read by:** `src/review/range.ts:222`.
- **Example:** `4`.

#### `binary` — `boolean`

- **Required or default:** required.
- **Purpose:** Indicates whether the file contains binary content.
- **Values:** `true` if file contains null bytes or non-text content; otherwise, `false`.
- **Populated by:** `src/review/range.ts:173`, `src/review/range.ts:191`, `src/review/range.ts:214`.
- **Read by:** `src/review/range.ts:221`.
- **Example:** `false`.

#### `committed` — `boolean`

- **Required or default:** required.
- **Purpose:** Indicates whether changes to this file belong to commits on the branch.
- **Values:** `true` if present in reviewed commit history; otherwise, `false`.
- **Populated by:** `src/review/range.ts:174`, `src/review/range.ts:192`, `src/review/range.ts:215`.
- **Read by:** Review reports to differentiate committed and working changes.
- **Example:** `true`.

#### `uncommitted` — `boolean`

- **Required or default:** required.
- **Purpose:** Indicates whether the file has uncommitted working tree changes.
- **Values:** `true` if modified locally or untracked; otherwise, `false`.
- **Populated by:** `src/review/range.ts:175`, `src/review/range.ts:181`, `src/review/range.ts:216`.
- **Read by:** Review reports to alert on uncommitted changes.
- **Example:** `false`.

### `ReviewRangeErrorReason`

Specific failure reason when review scope cannot be computed.

#### `value` — `'empty' | 'base-not-found' | 'shallow' | 'needs-start' | 'bad-ref' | 'no-commits'`

- **Required or default:** required.
- **Purpose:** Stable error reason identifier for `ReviewRangeError`.
- **Values:**
  - `'empty'`: no changed files remain after applying exclusions.
  - `'base-not-found'`: no base branch exists or was configured.
  - `'shallow'`: repository is a shallow clone.
  - `'needs-start'`: review on base branch lacks upstream commits or starting point.
  - `'bad-ref'`: the revision specified in `--since` or last run does not exist.
  - `'no-commits'`: repository contains no commits.
- **Populated by:** `src/review/range.ts:16`, `src/review/range.ts:57`, `src/review/range.ts:68`, `src/review/range.ts:77`, `src/review/range.ts:98`, `src/review/range.ts:133`, `src/review/range.ts:139`, `src/review/range.ts:218`.
- **Read by:** Tests and future CLI error formatters.
- **Example:** `'empty'`.

### `ReviewRange`

Complete structure defining review scope and changed files.

#### `mode` — `'branch' | 'unpushed' | 'since-run' | 'since-ref'`

- **Required or default:** required.
- **Purpose:** Resolution strategy used to define the review starting point.
- **Values:** `'branch'` (branch vs base), `'unpushed'` (unpushed commits), `'since-run'` (from prior run), or `'since-ref'` (from `--since`).
- **Populated by:** `src/review/range.ts:100`, `src/review/range.ts:121`, `src/review/range.ts:134`, `src/review/range.ts:145`.
- **Read by:** Report generators and run metadata.
- **Example:** `'branch'`.

#### `branch` — `string | null`

- **Required or default:** required.
- **Purpose:** Current branch name, or `null` if HEAD is detached.
- **Values:** Branch name string or `null`.
- **Populated by:** `src/review/range.ts:80`, `src/review/range.ts:227`.
- **Read by:** Report header and run metadata.
- **Example:** `'feat/plan-2-range'`.

#### `baseLabel` — `string`

- **Required or default:** required.
- **Purpose:** User-facing label of the comparison base.
- **Values:** Name of base branch or revision reference.
- **Populated by:** `src/review/range.ts:101`, `src/review/range.ts:122`, `src/review/range.ts:135`, `src/review/range.ts:146`.
- **Read by:** Report details section.
- **Example:** `'main'`.

#### `baseSha` — `string`

- **Required or default:** required.
- **Purpose:** 40-character hexadecimal SHA identifier of the base commit.
- **Values:** Hexadecimal commit hash.
- **Populated by:** `src/review/range.ts:102`, `src/review/range.ts:123`, `src/review/range.ts:136`, `src/review/range.ts:147`.
- **Read by:** Snapshot verifier and report.
- **Example:** `'403433ec40efe7cc940f0795105b83558cb5bdcd'`.

#### `headSha` — `string`

- **Required or default:** required.
- **Purpose:** 40-character hexadecimal SHA identifier of HEAD.
- **Values:** Hexadecimal commit hash.
- **Populated by:** `src/review/range.ts:75`, `src/review/range.ts:229`.
- **Read by:** Snapshot verifier and run metadata.
- **Example:** `'cb00bdead6979ede322f899e4d642715485444a1'`.

#### `commits` — `{ sha: string; subject: string }[]`

- **Required or default:** required.
- **Purpose:** List of commits in the review with their commit messages.
- **Values:** Array of objects containing `sha` and `subject`.
- **Populated by:** `src/review/range.ts:151`.
- **Read by:** Report details section.
- **Example:** `[{ sha: 'cb00...', subject: 'add login' }]`.

#### `files` — `ChangedFile[]`

- **Required or default:** required.
- **Purpose:** List of changed files to review.
- **Values:** Non-empty array of `ChangedFile` records.
- **Populated by:** `src/review/range.ts:206`.
- **Read by:** Rule selector and line change analyzers.
- **Example:** `[{ path: 'src/main.ts', status: 'modified', ... }]`.

#### `ignoredByConfig` — `string[]`

- **Required or default:** required.
- **Purpose:** File paths excluded by `config.ignore`.
- **Values:** Array of repository-relative path strings in alphabetical order.
- **Populated by:** `src/review/range.ts:204`.
- **Read by:** Report details section.
- **Example:** `['dist/bundle.js']`.

#### `added` — `number`

- **Required or default:** required.
- **Purpose:** Cumulative added line count across all reviewed files.
- **Values:** Integer greater than or equal to zero.
- **Populated by:** `src/review/range.ts:221`.
- **Read by:** Report overview and large change evaluation.
- **Example:** `120`.

#### `removed` — `number`

- **Required or default:** required.
- **Purpose:** Cumulative removed line count across all reviewed files.
- **Values:** Integer greater than or equal to zero.
- **Populated by:** `src/review/range.ts:222`.
- **Read by:** Report overview and large change evaluation.
- **Example:** `15`.

#### `large` — `boolean`

- **Required or default:** required.
- **Purpose:** Indicates whether total added and removed lines exceed `config.maxChangedLines`.
- **Values:** `true` if limit exceeded; otherwise, `false`.
- **Populated by:** `src/review/range.ts:223`.
- **Read by:** Review session orchestration and final report.
- **Example:** `false`.

## Where it is used

- [`src/review/range.ts`](170-review-range.md) imports all types from this module.
- [`src/review/range.test.ts`](../../../src/review/range.test.ts) validates data generated with these types.
- Future tasks will consume these types across rule selection and report models.

## Tests

- `src/review/range.test.ts`: validates `ReviewRange` and `ChangedFile` shapes across all modes.
Part 3 · Page 20 of 28 · Previous: [Pattern matcher](150-config-match.md) · Next: [Review range](170-review-range.md) · [Index](../README.md)


