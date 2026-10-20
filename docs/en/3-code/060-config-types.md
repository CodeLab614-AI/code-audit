Part 3 · Page 10 of 26 · Previous: [Configuration paths](050-config-paths.md) · Next: [Project configuration loader](070-config-config.md) · [Index](../README.md)
# Configuration types

**File:** `src/config/types.ts` · 38 lines · **Status:** available

## Page index

- What is it and what is it for?
- Types
- Where it is used
- Tests

## What is it and what is it for?

This file defines the shapes shared by the loaders to return configuration, rules, and diagnostics.

## Types

```ts
// These are the normalized values returned by the rule loader.
/** Lists the supported rule severities. */
export type Severity = 'critical' | 'major' | 'minor';

// The loader derives this category from the source folder.
/** Lists the kinds inferred from rule directory names. */
export type RuleKind = 'policy' | 'rule' | 'business' | 'decision' | 'template';

// Each item identifies one source location and one diagnostic.
/** Describes a configuration or rule loading issue. */
export interface Problem {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

// Optional YAML values become explicit normalized properties here.
/** Stores normalized project configuration values. */
export interface Config {
  structureVersion: 1;
  language: string;
  baseBranch?: string;
  ignore: string[];
  maxChangedLines: number;
}

// A Rule combines normalized metadata with its Markdown body.
/** Stores one validated rule and its Markdown body. */
export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  appliesTo: string[];
  keywords: string[];
  kind: RuleKind;
  file: string;
  body: string;
}
```


### `Severity`

Normalized rule impact.


#### `value` — `'critical' | 'major' | 'minor'`

- **Required or default:** required.
- **Purpose:** Stores one normalized rule severity.
- **Values:** Accepts `critical`, `major`, or `minor`; `grave`, `importante`, and `menor` map to those values. Trims surrounding whitespace and ignores case.
- **Filled by:** `src/config/rules.ts:43`, `src/config/rules.ts:87-88`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `critical`.


### `RuleKind`

Category inferred from the source folder.


#### `value` — `'policy' | 'rule' | 'business' | 'decision' | 'template'`

- **Required or default:** required.
- **Purpose:** Stores the singular category for the source folder.
- **Values:** Accepts `policy`, `rule`, `business`, `decision`, or `template` according to the folder.
- **Filled by:** `src/config/rules.ts:18`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `business`.


### `Problem`

A diagnostic produced while loading data.


#### `level` — `'error' | 'warning'`

- **Required or default:** required.
- **Purpose:** States the diagnostic severity.
- **Values:** `error` marks invalid input; if it occurs in a rule, that rule is excluded. `warning` reports unknown metadata and keeps a valid rule.
- **Filled by:** `src/config/config.ts:27`, `src/config/config.ts:36`, `src/config/config.ts:41`, `src/config/rules.ts:29`, `src/config/rules.ts:35`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts` and `src/config/rules.test.ts`).
- **Example:** `error`.


#### `file` — `string`

- **Required or default:** required.
- **Purpose:** Identifies the file that caused the diagnostic.
- **Values:** The path is relative to the repository root and uses forward slashes.
- **Filled by:** `src/config/config.ts:20`, `src/config/rules.ts:23`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts` and `src/config/rules.test.ts`).
- **Example:** `.agents/code-audit/config.md`.

#### `message` — `string`

- **Required or default:** required.
- **Purpose:** Explains the diagnostic.
- **Values:** Contains a parser or validation error, or the name of an unknown field.
- **Filled by:** `src/config/config.ts:27`, `src/config/config.ts:36`, `src/config/config.ts:41`, `src/config/config.ts:45`, `src/config/rules.ts:28-29`, `src/config/rules.ts:35`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts` and `src/config/rules.test.ts`).
- **Example:** `config.md not found`.

### `Config`

Normalized project configuration.


#### `structureVersion` — `1`

- **Required or default:** required; defaults to 1 when omitted.
- **Purpose:** Identifies the configuration structure version.
- **Values:** Only 1 is accepted. Another value produces an error and leaves the default in place.
- **Filled by:** `src/config/config.ts:8-9`, `src/config/config.ts:50-52`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts`).
- **Example:** `1`.

#### `language` — `string`

- **Required or default:** required; defaults to en when omitted.
- **Purpose:** Stores the requested language.
- **Values:** Keeps any non-empty text; an empty or non-text value produces an error and leaves en in place.
- **Filled by:** `src/config/config.ts:8-10`, `src/config/config.ts:53-55`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts`).
- **Example:** `es`.

#### `baseBranch` — `string`

- **Required or default:** optional; no default.
- **Purpose:** Stores the base branch name.
- **Values:** When omitted, the property is absent. When present, any text is accepted, including an empty string; a non-text value produces an error.
- **Filled by:** `src/config/config.ts:57-59`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts`).
- **Example:** `main`.

#### `ignore` — `string[]`

- **Required or default:** required; defaults to [] when omitted.
- **Purpose:** Stores path patterns to ignore.
- **Values:** A string becomes a one-item list; a list of strings is also accepted. Another type produces an error and leaves [].
- **Filled by:** `src/config/config.ts:11`, `src/config/config.ts:61-64`, `src/config/config.ts:80-83`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts`).
- **Example:** `["vendor/**"]`.

#### `maxChangedLines` — `number`

- **Required or default:** required; defaults to 1000 when omitted.
- **Purpose:** Stores the changed-line limit.
- **Values:** A positive integer replaces 1000; zero, negative numbers, fractions, and non-numbers produce an error and leave 1000.
- **Filled by:** `src/config/config.ts:12`, `src/config/config.ts:66-69`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/config.test.ts`).
- **Example:** `250`.

### `Rule`

A validated rule and its Markdown body.


#### `id` — `string`

- **Required or default:** required.
- **Purpose:** Identifies the rule.
- **Values:** Accepts any text with at least one character; whitespace is not trimmed.
- **Filled by:** `src/config/rules.ts:41`, `src/config/rules.ts:77-82`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `BIZ-003`.

#### `title` — `string`

- **Required or default:** required.
- **Purpose:** Stores the rule title.
- **Values:** Accepts any text with at least one character; whitespace is not trimmed.
- **Filled by:** `src/config/rules.ts:42`, `src/config/rules.ts:77-82`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `Amounts in cents`.

#### `severity` — `Severity`

- **Required or default:** required.
- **Purpose:** Stores the validated rule severity.
- **Values:** Uses `critical`, `major`, or `minor`; see `Severity` for accepted aliases.
- **Filled by:** `src/config/rules.ts:43`, `src/config/rules.ts:85-91`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `major`.

#### `appliesTo` — `string[]`

- **Required or default:** required.
- **Purpose:** Stores the path patterns where the rule applies.
- **Values:** For a `policies/` folder, omission or an empty list produces the global pattern. Other kinds require non-empty patterns.
- **Filled by:** `src/config/rules.ts:44`, `src/config/rules.ts:95-112`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `["src/billing/**"]`.

#### `keywords` — `string[]`

- **Required or default:** required; defaults to [] when omitted.
- **Purpose:** Stores keywords associated with the rule.
- **Values:** A string becomes a one-item list; a list of strings is also accepted. If omitted, it uses []; another type invalidates the rule.
- **Filled by:** `src/config/rules.ts:45`, `src/config/rules.ts:116-120`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `["price", "total"]`.

#### `kind` — `RuleKind`

- **Required or default:** required.
- **Purpose:** Stores the category derived from the source folder.
- **Values:** Uses the singular value associated with the `policies/`, `rules/`, `business/`, `decisions/`, or `templates/` folders.
- **Filled by:** `src/config/rules.ts:18`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `business`.

#### `file` — `string`

- **Required or default:** required.
- **Purpose:** Stores the rule file path.
- **Values:** The path is relative to the repository root and uses forward slashes.
- **Filled by:** `src/config/rules.ts:23`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `.agents/code-audit/business/money.md`.

#### `body` — `string`

- **Required or default:** required.
- **Purpose:** Keeps the Markdown after the YAML header.
- **Values:** Stores the text after the YAML header, including the final newline when present.
- **Filled by:** `src/config/rules.ts:26`, `src/config/rules.ts:50`.
- **Read by:** No production module consumes it today; the tests use it (`src/config/rules.test.ts`).
- **Example:** `Represent amounts in cents.\n`.

## Where it is used

- The [configuration loader](070-config-config.md) uses `Config` and `Problem` in the `loadConfig` contract.
- The [rule loader](080-config-rules.md) uses `Rule` and `Problem` in the `loadRules` contract.

No production module consumes these results today; the tests named in each field read them.

## Tests

- `src/config/config.test.ts`: defaults and config validation.
- `src/config/rules.test.ts`: rule normalization and diagnostics.

Part 3 · Page 10 of 26 · Previous: [Configuration paths](050-config-paths.md) · Next: [Project configuration loader](070-config-config.md) · [Index](../README.md)

