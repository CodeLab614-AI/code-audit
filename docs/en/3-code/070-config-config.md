Part 3 · Page 11 of 29 · Previous: [Configuration types](060-config-types.md) · Next: [Rule loader](080-config-rules.md) · [Index](../README.md)
# Project configuration loader

**File:** `src/config/config.ts` · 88 lines · **Status:** available

`loadConfig(root)` reads `.agents/code-audit/config.md`, parses its header and returns normalized values with diagnostics. Without it, callers would parse values and defaults themselves.

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

`loadConfig(root)` reads `.agents/code-audit/config.md`, parses its header and returns normalized values with diagnostics. Without it, callers would parse values and defaults themselves.

## Before reading the code

### Defaults

Absent values retain defaults.

```yaml
language: (missing)
max_changed_lines: (missing)
# → language "en", maxChangedLines 1000
```

YAML snake_case keys become camelCase properties.

### Diagnostics

Errors mark unusable values; warnings call out unknown field names.

```yaml
langauge: es
# → warning: unknown field: langauge
```

Known keys are still processed.

## How it fits

```mermaid
flowchart TD
    A["Project root" / "Raíz del proyecto"] --> B[".agents/code-audit"]
    B --> C["Read frontmatter" / "Leer frontmatter"]
    C --> D["Validate fields" / "Validar campos"]
    D --> E["Return values and problems" / "Devolver valores y problemas"]
```

`loadConfig` resolves the file path, reads UTF-8 text, calls `parseFrontmatter`, validates known keys against a default object, then returns the configuration and problems.

1. Resolve the input paths.
2. Read metadata and Markdown content.
3. Validate each value and collect diagnostics.
4. Return normalized data to the caller.

## The complete, commented code

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG_DIR } from './paths.js';
import type { Config, Problem } from './types.js';
import { FrontmatterError, parseFrontmatter } from './frontmatter.js';

// Start from the documented defaults so omitted keys stay predictable.
const DEFAULT_CONFIG: Config = {
  structureVersion: 1,
  language: 'en',
  ignore: [],
  maxChangedLines: 1000,
};

const CONFIG_FIELDS = new Set(['structure_version', 'language', 'base_branch', 'ignore', 'max_changed_lines']);

/** Loads and validates the project's config.md file. */
export async function loadConfig(root: string): Promise<{ config: Config; problems: Problem[] }> {
  // Keep reported paths relative while resolving reads from the supplied root.
  const file = `${CONFIG_DIR}/config.md`;
  const path = join(root, CONFIG_DIR, 'config.md');
  let text: string;
  // A missing file is still reported alongside usable default values.
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { config: createDefaultConfig(), problems: [{ level: 'error', file, message: 'config.md not found; run code-audit init first' }] };
  }

  let data: Record<string, unknown>;
  // Reuse the shared YAML reader and preserve its line-aware error.
  try {
    data = parseFrontmatter(text).data;
  } catch (error) {
    const message = error instanceof FrontmatterError ? error.message : String(error);
    return { config: createDefaultConfig(), problems: [{ level: 'error', file, message }] };
  }

  const problems: Problem[] = [];
  /** Adds a config diagnostic with the repository-relative file path. */
  const add = (level: Problem['level'], message: string): void => { problems.push({ level, file, message }); };
  // Unknown keys can reveal spelling mistakes without hiding valid values.
  for (const key of Object.keys(data)) {
    if (key === 'agent') add('error', 'agent must not be set: the agent that launches code-audit is always used');
    else if (!CONFIG_FIELDS.has(key)) add('warning', `unknown field: ${key}`);
  }

  // Validate each known key independently and retain defaults on errors.
  const config = createDefaultConfig();
  if (data.structure_version !== undefined) {
    if (typeof data.structure_version !== 'number' || !Number.isInteger(data.structure_version)) {
      add('error', `structure_version must be an integer; received ${JSON.stringify(data.structure_version)}`);
    } else if (data.structure_version !== 1) {
      add('warning', `structure_version is ${data.structure_version}; this code-audit understands structure version 1`);
    }
  }
  if (data.language !== undefined) {
    if (typeof data.language === 'string' && data.language.length > 0) config.language = data.language;
    else add('error', 'language must be a non-empty string');
  }
  if (data.base_branch !== undefined) {
    if (typeof data.base_branch === 'string') config.baseBranch = data.base_branch;
    else add('error', 'base_branch must be a string');
  }
  if (data.ignore !== undefined) {
    const ignore = normalizeStringList(data.ignore);
    if (ignore) config.ignore = ignore;
    else add('error', 'ignore must be a string or a list of strings');
  }
  if (data.max_changed_lines !== undefined) {
    if (typeof data.max_changed_lines === 'number' && Number.isInteger(data.max_changed_lines) && data.max_changed_lines > 0) {
      config.maxChangedLines = data.max_changed_lines;
    } else add('error', 'max_changed_lines must be a positive integer');
  }
  return { config, problems };
}

/** Returns defaults with a fresh list for each caller. */
function createDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG, ignore: [...DEFAULT_CONFIG.ignore] };
}

/** Converts one string or a list of strings to a fresh list. */
function normalizeStringList(value: unknown): string[] | undefined {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return undefined;
}
```

## Examples with real data

**Complete input (`config.md`):**

```yaml
---
structure_version: 1
language: es
base_branch: main
ignore: [vendor/**]
max_changed_lines: 250
---
```

**Observed output from `loadConfig(root)`:**

```json
{
  "config": {
    "structureVersion": 1,
    "language": "es",
    "ignore": ["vendor/**"],
    "maxChangedLines": 250,
    "baseBranch": "main"
  },
  "problems": []
}
```

Without the file, it returns defaults and `config.md not found; run code-audit init first`.

A quoted numeric value is text in YAML. The standalone CLI reports it with quotes so the received type is clear:

```text
$ node <standalone .mjs> check --root .
error   .agents/code-audit/config.md: structure_version must be an integer; received "1"
0 rules (0 policies). 1 error, 0 warnings.
$ echo $?
2
```

## Behavior summary

- **Missing file**: returns defaults and `config.md not found; run code-audit init first`.
- **Different integer structure version**: returns a warning: `structure_version is <N>; this code-audit understands structure version 1`.
- **Non-integer structure version**: returns an error and quotes text values, for example `received "1"`.
- **Agent field**: reports the exact planned error message.
- **Unknown field**: returns a warning: `unknown field: X`.
- **Invalid threshold**: requires a positive integer.

## Where it is used

- [050-config-paths.md](050-config-paths.md), provides `CONFIG_DIR`.
- [040-config-frontmatter.md](040-config-frontmatter.md), provides `parseFrontmatter`, imported at line 5.

## Tests

- `src/config/config.test.ts`: defaults and missing file.
- `src/config/config.test.ts`: a different integer version warns; a non-integer is an error.
- `src/config/config.test.ts`: exact `agent` error.
- `src/config/config.test.ts`: zero and nonnumeric limits.
Part 3 · Page 11 of 29 · Previous: [Configuration types](060-config-types.md) · Next: [Rule loader](080-config-rules.md) · [Index](../README.md)


