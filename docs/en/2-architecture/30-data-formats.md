Part 2 · Page 5 of 32 · Previous: [Command line](20-cli.md) · Next: [Program entry point](../3-code/010-bin.md) · [Index](../README.md)
# Data formats

This document defines the structure and validation contracts for `code-audit` data exchange files, beginning with `findings.json` schema version 1.

The specification for `run.json` will be added to this page during Task 9 of Plan 2.

## Contract for `findings.json` v1

The `findings.json` file records issues detected by isolated review sessions before the final report is compiled. The file uses snake_case keys because it is authored by artificial intelligence sessions and subsequently normalized by the command line interface.

### Global structure

```json
{
  "schema_version": 1,
  "summary": "Concise summary within at most three lines.",
  "criteria": [
    { "number": 1, "status": "met", "reason": "Optional" }
  ],
  "findings": [],
  "out_of_scope": [],
  "ideas": [],
  "suggested_rules": [],
  "impact": [],
  "discarded": []
}
```

### Top-level fields

| Field | Type | Required | Behavior when invalid |
|---|---|---|---|
| `schema_version` | `number` | Yes | If not `1`, immediate file rejection (`FindingsInvalidError`). |
| `summary` | `string` | Yes | If not a string, immediate file rejection (`FindingsInvalidError`). |
| `findings` | `array` | Yes | If not an array, immediate file rejection (`FindingsInvalidError`). |
| `criteria` | `array` | No | If not an array, treated as empty array and recorded in notes. |
| `out_of_scope` | `array` | No | If not an array, treated as empty array and recorded in notes. |
| `ideas` | `array` | No | If not an array, treated as empty array and recorded in notes. |
| `suggested_rules` | `array` | No | If not an array, treated as empty array and recorded in notes. |
| `impact` | `array` | No | If not an array, treated as empty array and recorded in notes. |
| `discarded` | `array` | No | If not an array, treated as empty array and recorded in notes. |

Any input that fails to parse as valid JSON or is not an object immediately triggers total rejection with `FindingsInvalidError`.

### Null value interpretation rule

Automated review sessions conducted with large language models frequently emit `null` to represent the absence of an optional value. To avoid discarding otherwise valid findings:

- Across **every optional field**—whether at finding level (`end_line`, `rule_id`, `suggestion`, `existing`, `related_note`, `related_findings`, `related_criteria`, `verified`), top level (`criteria`, `out_of_scope`, `ideas`, `suggested_rules`, `impact`, `discarded`), or within list items (`existing.line`, `out_of_scope[].line`, `suggested_rules[].from_finding`, `criteria[].reason`)—the value `null` behaves identically to omitting the field entirely: **it causes no discard and produces no warning note**.
- **Required exception:** `line: null` when `whole_file: true` is not set is treated as an absent required `line` field, discarding the finding with `missing or invalid field: line`.

### Finding fields (`findings`)

Each element inside `findings` must be an object. Non-object elements are discarded with the reason `finding is not an object`.

| Field | Type | Required | Behavior when invalid |
|---|---|---|---|
| `id` | `string` | Yes | Non-empty string. If missing or duplicate (case-insensitive), discarded with `missing or invalid field: id` or `duplicate id: <id>`. |
| `title` | `string` | Yes | Non-empty string. If missing, discarded with `missing or invalid field: title`. |
| `severity` | `string` | Yes | Must match `critical`, `major`, `minor`, or localized aliases (`grave`, `importante`, `menor`). Discarded if unrecognized. |
| `file` | `string` | Yes | Relative path to a regular file within repository boundaries. Discarded if not found or outside root. |
| `impact` | `string` | Yes | Non-empty string. If missing, discarded with `missing or invalid field: impact`. |
| `whole_file` | `boolean` | No | If `true`, line numbers and quote verification are skipped. |
| `line` | `number` | Conditional | Positive integer (≥ 1). Required unless `whole_file` is `true`. Discarded if missing or out of bounds. |
| `end_line` | `number` | No | Positive integer (≥ 1). Defaults to `line` if missing or `null`. If less than `line`, discarded with `end_line is before line`. |
| `quote` | `string` | Yes | Non-empty string. If it cannot be matched against file lines, discarded. |
| `suggestion` | `object` | No | Object containing `start_line` and `code`. If invalid, removed from finding and recorded in notes. |
| `rule_id` | `string` | No | Must match one selected rule case-insensitively. Discarded if rule is not among selected rules. |
| `related_findings`| `array` | No | List of finding ids. Nonexistent, discarded, or cyclic references are removed; finding is retained. |
| `related_criteria`| `array` | No | List of criteria numbers. Numbers not present in task criteria are removed. |
| `related_note` | `string` | No | Explanatory note. If wrong type, removed and recorded in notes. |
| `existing` | `object` | No | Reference `{ file, line, note }`. If file or line is invalid, removed and recorded in notes. |
| `verified` | `boolean` | No | Boolean flag. If wrong type, defaults to `false` and is recorded in notes. |

### Deterministic finding order

Accepted findings are ordered deterministically by successively evaluating the following sorting criteria:

1. **Severity:** `critical` first, followed by `major`, and lastly `minor`.
2. **File path (`file`):** Strict lexicographical ordering by Unicode code points.
3. **File scope:** When paths match, a finding with `whole_file: true` precedes a finding with a specific line number.
4. **Start line (`line`):** Ascending numeric ordering by starting line (findings without a line count as line 0).
5. **Input order:** If identical across all preceding keys, the relative order from the input file is preserved.

### Structure of auxiliary list elements

#### Task acceptance criteria (`criteria`)

Evaluates the acceptance criteria specified in the task brief (`task`):

- **Element properties:**
  - `number`: Positive integer corresponding to criterion position in the task brief (starting at 1).
  - `status`: Evaluation status, strictly `'met'`, `'partial'`, or `'not_met'`.
  - `reason`: Optional string providing the rationale for the verdict.
- **Invalid entries:** If an item is not an object, its number is not an integer in range, its status is not among the three allowed values, or its reason is not a string, the item is ignored and recorded in notes: `invalid criterion entry <json>, ignored`.
- **Duplicate numbers:** When multiple entries provide the same criterion number, the first evaluated occurrence is retained and subsequent repeats are dropped with: `duplicate criterion number <n>, first entry retained`.
- **Unaddressed criteria (`not_evaluated`):** Any task criterion omitted by the session is automatically completed with status `not_evaluated`, using its number and original task criterion text.
- **Missing task brief:** If validation is executed without a task brief (`task` undefined), `criteria` always resolves to an empty array `[]`.

#### Out of scope modifications (`out_of_scope`)

Records changes observed outside the requested scope of the review:

- **Element properties:**
  - `file`: Repository-relative path (required string). Subject to identical checks as findings: must exist, be a regular file, and remain inside repository root.
  - `line`: Optional positive integer. If omitted or `null`, refers to the entire file.
  - `note`: Required explanatory text detailing the unrequested modification.
- **Invalid entries:** If `file` or `note` is missing, the entry is ignored with: `invalid out_of_scope entry <json>, ignored`. If the path does not exist or escapes repository root, it records: `invalid out_of_scope file "<file>": <reason>, ignored`. If `line` is not an integer or exceeds the file line count, it records: `line <line> is outside <file> in out_of_scope, ignored`.

#### Ideas (`ideas`)

List of supplemental ideas and improvement suggestions noted during review:

- **Format:** Each element must be a string (`string`). Non-string values are silently filtered and removed.
- **Limit of 5 ideas:** The validator accepts a maximum of 5 ideas. If input supplies more than 5, only the first 5 are preserved and an informative note is emitted: `retained first 5 ideas (received <n>)`.

#### Suggested rules (`suggested_rules`)

New rule recommendations derived from findings encountered during review:

- **Element properties:**
  - `text`: Required descriptive text defining the suggested rule.
  - `from_finding`: Optional identifier of the finding that inspired the recommendation.
- **Origin finding resolution:** If `from_finding` is specified and matches (case-insensitively) an accepted finding, it is resolved to the canonical casing of that finding (`fromFinding`); if unreferenced or missing, it remains undefined.
- **Invalid entries:** If an element is not an object, it records: `suggested_rules entry must be an object, ignored`. If `text` is missing or not a string, it records: `suggested_rules entry missing text, ignored`.

#### Global impact (`impact`)

High-level observations regarding the broad effects of the reviewed changes:

- **Format:** Each element must be a string (`string`). All valid strings are kept; non-string items are omitted.

#### Discarded findings from session (`discarded`)

Enables the review session to document findings it investigated and intentionally discarded:

- **Element properties:**
  - `id`: Finding identifier. If missing or empty, a positional fallback `#1`, `#2`, etc., is generated.
  - `title`: Finding title. If missing, normalized to an empty string `""`.
  - `reason`: Reason for discarding. If missing, normalized to an empty string `""`.
- **Non-object entries:** Non-object items are replaced by `{ id: "#<position>", title: "", reason: "" }`.
- **Output combination:** These entries are stored in `data.discarded` in normalized output, whereas program discards triggered during validation are returned separately under the root `discarded` property.

### Quote verification rule (`quote`)

Quote verification ensures cited lines actually exist in the current working tree:

1. Target lines from `line` to `end_line` (inclusive) are extracted from the file.
2. Each line is trimmed of leading and trailing whitespace, and internal sequences of tabs or spaces are collapsed into single spaces.
3. Blank lines at the start and end of `quote` are removed. If no content remains, the finding is discarded.
4. Each line of `quote` is normalized using the same whitespace and tab compression rule.
5. The normalized quote must appear inside the normalized file slice joined by newlines. If it does not match, the finding is discarded with: `quote not found in <file> at lines <line>-<end_line>`.

### Exact discard reasons

Discarded findings produce a record in the discarded list containing one of these exact reason strings:

- `missing or invalid field: <campo>`
- `invalid severity: <valor>`
- `end_line is before line`
- `duplicate id: <id>`
- `finding is not an object`
- `rule <rule_id> is not among the selected rules`
- `invalid path: <file>`
- `file not found: <file>`
- `line <n> is outside <file> (<total> lines)`
- `quote not found in <file> at lines <line>-<end_line>`

### Complete and valid example

The following example illustrates the plan execution payload with all fields successfully validated (zero discarded findings and zero notes):

```json
{
  "schema_version": 1,
  "summary": "Tres líneas como máximo: qué hizo el cambio y qué está mal.",
  "criteria": [
    {
      "number": 2,
      "status": "not_met",
      "reason": "Lo calcula con decimales."
    }
  ],
  "findings": [
    {
      "id": "F1",
      "title": "El total se calcula con decimales y puede cobrar mal",
      "severity": "critical",
      "file": "src/billing/total.ts",
      "line": 41,
      "end_line": 41,
      "whole_file": false,
      "quote": "const total = price * 1.16",
      "impact": "Qué pasaría en la práctica.",
      "suggestion": {
        "start_line": 40,
        "code": "const priceCents = item.priceCents\n…"
      },
      "rule_id": "BIZ-003",
      "related_findings": [],
      "related_criteria": [2],
      "related_note": "Se resuelve también con el problema 3.",
      "existing": {
        "file": "src/ui/Button.tsx",
        "line": 1,
        "note": "Botón con estado «cargando»."
      },
      "verified": true
    }
  ],
  "out_of_scope": [
    {
      "file": "src/auth/session.ts",
      "line": 88,
      "note": "Sesiones de usuario."
    }
  ],
  "ideas": [
    "El cálculo del IVA está repetido en dos lugares."
  ],
  "suggested_rules": [
    {
      "text": "Todo botón que cobre se desactiva mientras espera.",
      "from_finding": "F1"
    }
  ],
  "impact": [
    "El total también lo usan las facturas y los reembolsos."
  ],
  "discarded": [
    {
      "id": "F7",
      "title": "…",
      "reason": "El verificador encontró la validación en la línea 12."
    }
  ]
}
```

Part 2 · Page 5 of 32 · Previous: [Command line](20-cli.md) · Next: [Program entry point](../3-code/010-bin.md) · [Index](../README.md)

