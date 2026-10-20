Part 3 · Page 12 of 28 · Previous: [Project configuration loader](070-config-config.md) · Next: [Task loader](090-config-task.md) · [Index](../README.md)
# Rule loader

**File:** `src/config/rules.ts` · 131 lines · **Status:** available

`loadRules(root)` searches the five rule folders, parses each Markdown header, validates files independently and returns valid rules in stable path order with their diagnostics.

## Page index

- What is it and what is it for?
- Before reading the code
- How it fits
- The complete, commented code
- Examples with real data
- Behavior summary
- Where it is used
- Tests

## What is it and what is it for?

`loadRules(root)` searches the five rule folders, parses each Markdown header, validates files independently and returns valid rules in stable path order with their diagnostics.

## Before reading the code

### Severity aliases

Severity matching trims surrounding whitespace and ignores case.

```yaml
severity: grave
# → critical
```

Only the six documented values are accepted.

### Policy patterns

Policies can omit `applies_to` or use an empty list to apply everywhere. Other kinds need a pattern.

```yaml
applies_to: []
# policy → ["**"]
```

Patterns and keywords may be one string or a list.

## How it fits

```mermaid
flowchart TD
    A["Project root" / "Raíz del proyecto"] --> B[".agents/code-audit"]
    B --> C["Read YAML header" / "Leer YAML header"]
    C --> D["Validate fields" / "Validar campos"]
    D --> E["Return values and problems" / "Devolver valores y problemas"]
```

For every configured rule folder, the loader visits regular subfolders without following symlinks, selects `.md` files except any `README.md`, parses each YAML header block, validates fields, and sorts rules by repository-relative path.

1. Resolve the input paths.
2. Read metadata and Markdown content.
3. Validate each value and collect diagnostics.
4. Return normalized data to the caller.

## The complete, commented code

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { CONFIG_DIR, RULE_DIRS } from './paths.js';
import type { Problem, Rule, RuleKind, Severity } from './types.js';
import { FrontmatterError, parseFrontmatter } from './frontmatter.js';

const RULE_FIELDS = new Set(['id', 'title', 'severity', 'applies_to', 'keywords']);
const SEVERITIES: Record<string, Severity> = {
  critical: 'critical', major: 'major', minor: 'minor',
  grave: 'critical', importante: 'major', menor: 'minor',
};

/** Loads Markdown rules recursively from the project's rule directories. */
export async function loadRules(root: string): Promise<{ rules: Rule[]; problems: Problem[] }> {
  const rules: Rule[] = [];
  const problems: Problem[] = [];
  // Load categories separately so one malformed file cannot stop the scan.
  for (const [directory, kind] of Object.entries(RULE_DIRS) as [keyof typeof RULE_DIRS, RuleKind][]) {
    const folder = join(root, CONFIG_DIR, directory);
    const files = await markdownFiles(folder);
    // Keep diagnostics attached to the file that produced them.
    for (const absolute of files) {
      const file = toRepoPath(relative(root, absolute));
      let parsed: { data: Record<string, unknown>; body: string };
      try {
        parsed = parseFrontmatter(await readFile(absolute, 'utf8'));
      } catch (error) {
        const message = error instanceof FrontmatterError ? error.message : String(error);
        problems.push({ level: 'error', file, message });
        continue;
      }

      const localProblems: Problem[] = [];
      /** Adds a diagnostic for the current rule file. */
      const add = (level: Problem['level'], message: string): void => { localProblems.push({ level, file, message }); };
      // Unknown metadata is useful feedback but does not invalidate a rule.
      for (const key of Object.keys(parsed.data)) {
        if (!RULE_FIELDS.has(key)) add('warning', `unknown field: ${key}`);
      }

      const id = requiredText(parsed.data, 'id', add);
      const title = requiredText(parsed.data, 'title', add);
      const severity = parseSeverity(parsed.data.severity, add);
      const appliesTo = parseAppliesTo(parsed.data.applies_to, directory === 'policies', add);
      const keywords = parsed.data.keywords === undefined ? [] : parseTextList(parsed.data.keywords, 'keywords', add);
      // Warnings preserve the rule; any validation error excludes it.
      const hasErrors = localProblems.some((problem) => problem.level === 'error');
      problems.push(...localProblems);
      if (!hasErrors && id !== undefined && title !== undefined && severity !== undefined && appliesTo !== undefined && keywords !== undefined) {
        rules.push({ id, title, severity, appliesTo, keywords, kind, file, body: parsed.body });
      }
    }
  }
  // A code-unit comparison gives the same order across machine locales.
  rules.sort((a, b) => compareText(a.file, b.file));
  // Stable sorting retains the order in which each file's issues were detected.
  problems.sort((a, b) => compareText(a.file, b.file));
  return { rules, problems };
}

/** Recursively lists Markdown files without following symbolic links. */
async function markdownFiles(folder: string): Promise<string[]> {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); } catch { return []; }
  const files: string[] = [];
  // Dirent checks prevent traversal through symbolic links.
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'readme.md') files.push(path);
  }
  return files;
}

/** Adds a required text field or reports the field-specific error. */
function requiredText(data: Record<string, unknown>, field: string, add: (level: Problem['level'], message: string) => void): string | undefined {
  const value = data[field];
  if (typeof value === 'string' && value.length > 0) return value;
  add('error', value === undefined ? `${field} is required` : `${field} must be a non-empty string`);
  return undefined;
}

/** Resolves a severity name or alias after trimming whitespace and ignoring case. */
function parseSeverity(value: unknown, add: (level: Problem['level'], message: string) => void): Severity | undefined {
  if (value === undefined) {
    add('error', 'severity is required');
    return undefined;
  }
  if (typeof value === 'string') {
    const severity = SEVERITIES[value.trim().toLowerCase()];
    if (severity) return severity;
  }
  add('error', 'severity must be one of: critical, major, minor, grave, importante, menor');
  return undefined;
}

/** Resolves rule file patterns and applies the policy-wide default. */
function parseAppliesTo(value: unknown, policy: boolean, add: (level: Problem['level'], message: string) => void): string[] | undefined {
  if (value === undefined && policy) return ['**'];
  if (value === undefined) {
    add('error', 'applies_to is required outside policies/');
    return undefined;
  }
  const values = parseTextList(value, 'applies_to', add);
  if (!values) return undefined;
  if (policy && (values.length === 0 || (values.length === 1 && values[0] === ''))) return ['**'];
  if (values.some((item) => item.length === 0)) {
    add('error', 'applies_to entries must not be empty');
    return undefined;
  }
  if (values.length === 0) {
    add('error', 'applies_to is required outside policies/');
    return undefined;
  }
  return values;
}

/** Converts a text or text array to a list and reports invalid values. */
function parseTextList(value: unknown, field: string, add: (level: Problem['level'], message: string) => void): string[] | undefined {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  add('error', `${field} must be a string or a list of strings`);
  return undefined;
}

/** Converts native path separators to repository-style forward slashes. */
function toRepoPath(path: string): string { return path.split(sep).join('/'); }

/** Compares strings by Unicode code units for machine-independent ordering. */
function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
```

## Examples with real data

**Complete inputs (`config.md` and two rules):**

```yaml
# config.md
---
structure_version: 1
language: es
base_branch: main
ignore: [vendor/**]
max_changed_lines: 250
---

# policies/encoding.md
---
id: POL-001
title: Usar UTF-8
severity: grave
---
Los archivos se guardan en UTF-8.

# business/money.md
---
id: BIZ-003
title: Montos en centavos
severity: importante
applies_to: src/billing/**
keywords: [precio, total]
---
Representa montos en centavos.
```

**Observed output from `loadRules(root)`:**

```json
{
  "rules": [
    {"id":"BIZ-003","title":"Montos en centavos","severity":"major","appliesTo":["src/billing/**"],"keywords":["precio","total"],"kind":"business","file":".agents/code-audit/business/money.md","body":"Representa montos en centavos.\n"},
    {"id":"POL-001","title":"Usar UTF-8","severity":"critical","appliesTo":["**"],"keywords":[],"kind":"policy","file":".agents/code-audit/policies/encoding.md","body":"Los archivos se guardan en UTF-8.\n"}
  ],
  "problems": []
}
```

The actual command produced these normalized aliases and file-sorted rules.

A rule without `severity` is excluded and reports a field-specific error. This output was captured with the standalone CLI in a temporary Git repository:

```text
$ node <standalone .mjs> check --root .
error   .agents/code-audit/business/c.md: severity is required
0 rules (0 policies). 1 error, 0 warnings.
$ echo $?
2
```

## Behavior summary

- **Missing folder**: does not produce a problem.
- **README.md**: is skipped at every depth.
- **Malformed Markdown header**: reports a YAML header error, including its line.
- **Unknown field**: adds a warning: `unknown field: X`.
- **Missing severity**: reports `severity is required`; an invalid value retains the list of accepted severities.
- **Rule with errors**: is reported and excluded; other rules still load.
- **Rule path**: is repository-relative and uses `/`.

## Where it is used

- [050-config-paths.md](050-config-paths.md), supplies `CONFIG_DIR` and `RULE_DIRS`.
- [060-config-types.md](060-config-types.md), declares `Rule` and `Problem`.
- [040-config-frontmatter.md](040-config-frontmatter.md), provides `parseFrontmatter`.

## Tests

- `src/config/rules.test.ts`: recursive traversal, ordering and README omission.
- `src/config/rules.test.ts`: severity aliases, surrounding whitespace, and Spanish names.
- `src/config/rules.test.ts`: required fields and `policies/` patterns.
- `src/config/rules.test.ts`: deterministic problem ordering, malformed headers, invalid values, and unknown fields.
Part 3 · Page 12 of 28 · Previous: [Project configuration loader](070-config-config.md) · Next: [Task loader](090-config-task.md) · [Index](../README.md)


