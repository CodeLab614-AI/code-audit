Part 3 · Page 9 of 20 · Previous: [Frontmatter reader](040-config-frontmatter.md) · Next: [Configuration types](060-config-types.md) · [Index](../README.md)
# Configuration paths

**File:** `src/config/paths.ts` · 13 lines · **Status:** available

This module names the project configuration folder and maps rule folders to their kinds. Both loaders use it so paths and rule types stay consistent.

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

This module names the project configuration folder and maps rule folders to their kinds. Both loaders use it so paths and rule types stay consistent.

## Before reading the code

### Directory constant

`CONFIG_DIR` is relative to the repository root.

```ts
// Keep one canonical path for configuration files and diagnostics.
/** Names the project-local Code Audit configuration directory. */
export const CONFIG_DIR = '.agents/code-audit';

// Folder names are plural on disk; values are singular in Rule.kind.
/** Maps rule folders to the kind recorded in each loaded rule. */
export const RULE_DIRS = {
  policies: 'policy',
  rules: 'rule',
  business: 'business',
  decisions: 'decision',
  templates: 'template',
} as const;
```

It keeps file lookup aligned with reported paths.

### Folder map

`RULE_DIRS` connects a plural disk folder to a singular rule kind.

```ts
RULE_DIRS.policies
// → policy
```

`as const` preserves literal values for TypeScript.

## How it fits

```mermaid
flowchart TD
    A["Project root" / "Raíz del proyecto"] --> B[".agents/code-audit"]
    B --> C["Read YAML header" / "Leer encabezado YAML"]
    C --> D["Validate fields" / "Validar campos"]
    D --> E["Return values and problems" / "Devolver valores y problemas"]
```

The config loader imports `CONFIG_DIR`; the rule loader imports both exports. The folder map supplies each `Rule.kind`.

1. Resolve the input paths.
2. Read metadata and Markdown content.
3. Validate each value and collect diagnostics.
4. Return normalized data to the caller.

## The complete, commented code

```ts
/** Names the project-local Code Audit configuration directory. */
export const CONFIG_DIR = '.agents/code-audit';

/** Maps rule folders to the kind recorded in each loaded rule. */
export const RULE_DIRS = {
  policies: 'policy',
  rules: 'rule',
  business: 'business',
  decisions: 'decision',
  templates: 'template',
} as const;
```

## Examples with real data

The constants have no runtime input. This command imported them from the repository and printed their values:

```sh
bun -e 'import { CONFIG_DIR, RULE_DIRS } from "./src/config/paths.ts"; console.log(JSON.stringify({CONFIG_DIR, RULE_DIRS}, null, 2));'
```

```json
{
  "CONFIG_DIR": ".agents/code-audit",
  "RULE_DIRS": {
    "policies": "policy",
    "rules": "rule",
    "business": "business",
    "decisions": "decision",
    "templates": "template"
  }
}
```
## Behavior summary

- **Configuration location**: both loaders use `.agents/code-audit`.
- **Rule kind**: each plural folder maps to a singular kind.
- **Missing folder**: the rule loader treats it as an empty collection.

## Where it is used

- [070-config-config.md](070-config-config.md), the config loader imports this constant at line 3.
- [080-config-rules.md](080-config-rules.md), the rule loader imports these values at lines 3–4.

## Tests

- `src/config/config.test.ts`: missing-file defaults.
Part 3 · Page 9 of 20 · Previous: [Frontmatter reader](040-config-frontmatter.md) · Next: [Configuration types](060-config-types.md) · [Index](../README.md)
