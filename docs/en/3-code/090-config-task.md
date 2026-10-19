Part 3 · Page 13 of 23 · Previous: [Rule loader](080-config-rules.md) · Next: [Read-only Git interface](100-git-git.md) · [Index](../README.md)
# Task loader

**File:** `src/config/task.ts` · 167 lines · **Status:** available

`loadTask(root, taskPath)` reads one Markdown task file, normalizes its sections and acceptance criteria, and returns a `Task` with diagnostics. Its optional YAML header can contain `source`.

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

A task brief is the `.md` file containing what a task asks for, copied by a person from Jira, GitHub, or Notion. This module reads it, checks for an objective and numbered acceptance criteria, then returns the data or a list of problems.

## Before reading the code

### Frontmatter

Frontmatter is an optional YAML block at the start of a Markdown file. The task loader accepts only the `source` field; other fields produce warnings.

```yaml
source: https://example.test/TASK-1
# → task.source is the URL
```

### Sections and criteria

Task sections use level-two Markdown headings. Acceptance criteria begin with a number and `.` or `)`. Indented lines continue the current criterion.

```markdown
## Acceptance criteria
1. First line
   continuation
```

The result contains one criterion: `First line continuation`.

## Accepted headings

| Field | Spanish heading | English heading |
|---|---|---|
| objective | Objetivo | Objective |
| criteria | Criterios de aceptación | Acceptance criteria |
| out of scope | Fuera de alcance | Out of scope |
| expected areas | Áreas que se espera tocar | Expected areas |
| notes | Notas y decisiones; Notas | Notes; Notes and decisions |

Headings are compared without case, accents, repeated spaces, a trailing parenthetical note, or a final colon.

## How it fits

```mermaid
flowchart TD
    A[Task Markdown file] --> B[loadTask]
    B --> C[parseFrontmatter]
    B --> D[Task and Problem types]
    C --> E[Normalized task or diagnostics]
    D --> E
```

1. `loadTask` resolves and reads the requested path.
2. It optionally parses YAML frontmatter and records metadata warnings.
3. It recognizes level-two sections outside fenced code blocks.
4. It validates the objective and numbered criteria, then returns a task only when there are no errors.

## The complete, commented code

```ts
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { FrontmatterError, parseFrontmatter } from './frontmatter.js';
import type { Problem } from './types.js';

/** Stores one normalized task specification. */
export interface Task {
  file: string;
  source?: string;
  objective: string;
  criteria: string[];
  outOfScope?: string;
  expectedAreas?: string;
  notes?: string;
}

const SECTION_FIELDS = new Map<string, keyof Pick<Task, 'objective' | 'criteria' | 'outOfScope' | 'expectedAreas' | 'notes'>>([
  ['objetivo', 'objective'], ['objective', 'objective'],
  ['criterios de aceptacion', 'criteria'], ['acceptance criteria', 'criteria'],
  ['fuera de alcance', 'outOfScope'], ['out of scope', 'outOfScope'],
  ['areas que se espera tocar', 'expectedAreas'], ['expected areas', 'expectedAreas'],
  ['notas y decisiones', 'notes'], ['notas', 'notes'], ['notes', 'notes'], ['notes and decisions', 'notes'],
]);

/** Loads and validates a Markdown task specification. */
export async function loadTask(root: string, taskPath: string): Promise<{ task?: Task; problems: Problem[] }> {
  const absolute = isAbsolute(taskPath) ? taskPath : resolve(root, taskPath);
  const file = toTaskPath(root, absolute);
  let text: string;
  try {
    text = await readFile(absolute, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { problems: [{ level: 'error', file, message: `could not read task file "${taskPath}": ${detail}` }] };
  }

  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  let data: Record<string, unknown> = {};
  let body = text;
  if (/^---[ \t]*(?:\n|$)/.test(text)) {
    try {
      ({ data, body } = parseFrontmatter(text));
    } catch (error) {
      const message = error instanceof FrontmatterError ? error.message : String(error);
      return { problems: [{ level: 'error', file, message }] };
    }
  }

  const problems: Problem[] = [];
  /** Adds a diagnostic tied to the current task file. */
  const add = (level: Problem['level'], message: string): void => { problems.push({ level, file, message }); };
  for (const key of Object.keys(data)) {
    if (key !== 'source') add('warning', `unknown field: ${key}`);
  }
  const source = data.source;
  if (source !== undefined && typeof source !== 'string') add('error', 'source must be a string');

  const sections = parseSections(body, add);
  const objective = sections.get('objective')?.text;
  if (!objective) add('error', 'objective is required');
  const criteriaText = sections.get('criteria')?.text;
  const criteria = parseCriteria(criteriaText);
  if (!criteria) add('error', 'acceptance criteria must be a numbered list');

  if (problems.some((problem) => problem.level === 'error') || objective === undefined || criteria === undefined) {
    return { problems };
  }

  const task: Task = { file, objective, criteria };
  if (typeof source === 'string') task.source = source;
  const outOfScope = sections.get('outOfScope')?.text;
  const expectedAreas = sections.get('expectedAreas')?.text;
  const notes = sections.get('notes')?.text;
  if (outOfScope) task.outOfScope = outOfScope;
  if (expectedAreas) task.expectedAreas = expectedAreas;
  if (notes) task.notes = notes;
  return { task, problems };
}

interface Section {
  title: string;
  text: string;
}

/** Extracts recognized level-two sections and reports unknown or repeated ones. */
function parseSections(body: string, add: (level: Problem['level'], message: string) => void): Map<string, Section> {
  const sections = new Map<string, Section>();
  const lines = body.split('\n');
  let currentField: string | undefined;
  let currentTitle = '';
  let currentLines: string[] = [];
  let fenceChar: string | undefined;
  let fenceLength = 0;

  /** Saves the active section after trimming its outer blank lines. */
  const save = (): void => {
    if (!currentField) return;
    const text = currentLines.join('\n').trim();
    sections.set(currentField, { title: currentTitle, text });
  };

  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const token = fence[1]!;
      const char = token[0]!;
      if (!fenceChar) {
        fenceChar = char;
        fenceLength = token.length;
      } else if (char === fenceChar && token.length >= fenceLength) {
        fenceChar = undefined;
        fenceLength = 0;
      }
      if (currentField) currentLines.push(line);
      continue;
    }

    const heading = fenceChar ? undefined : line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (heading) {
      save();
      currentLines = [];
      currentTitle = heading[1]!.trim();
      const field = SECTION_FIELDS.get(normalizeHeading(currentTitle));
      currentField = field;
      if (!field) add('warning', `unknown section: ${currentTitle}`);
      else if (sections.has(field)) add('error', `duplicate section: ${currentTitle}`);
      continue;
    }
    if (currentField) currentLines.push(line);
  }
  save();
  return sections;
}

/** Normalizes a heading for case, accents, spacing, and trailing parentheticals. */
function normalizeHeading(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*:\s*$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Parses numbered criteria and joins indented continuation lines. */
function parseCriteria(text: string | undefined): string[] | undefined {
  if (text === undefined || text.length === 0) return undefined;
  const criteria: string[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const item = line.match(/^\s*\d+[.)]\s+(.+?)\s*$/);
    if (item) {
      criteria.push(item[1]!.trim());
      continue;
    }
    if (/^\s+\S/.test(line) && criteria.length > 0) {
      criteria[criteria.length - 1] += ` ${line.trim()}`;
      continue;
    }
    return undefined;
  }
  return criteria.length > 0 ? criteria : undefined;
}

/** Converts an absolute path to a repository-relative task path when possible. */
function toTaskPath(root: string, absolute: string): string {
  const path = relative(resolve(root), resolve(absolute));
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)
    ? absolute.split(sep).join('/')
    : path.split(sep).join('/');
}
```

## Examples with real data

### Normal case

This is the complete design template from section 4.2, including its empty optional sections. Running the following input with `loadTask` produced the shown output:

```ts
const input = `---
source: https://empresa.atlassian.net/browse/PAY-123
---
## Objetivo
Qué se quiere lograr y por qué.

## Criterios de aceptación
1. Botón «Pagar» visible en el checkout.
2. Total con IVA calculado en centavos.
3. Mensaje si el cobro falla, con opción de reintentar.

## Fuera de alcance

## Áreas que se espera tocar (opcional)

## Notas y decisiones (Figma, acuerdos)
`;
await writeFile(join(root, 'PAY-123.md'), input);
console.log(JSON.stringify(await loadTask(root, 'PAY-123.md'), null, 2));
```

```json
{
  "task": {
    "file": "PAY-123.md",
    "objective": "Qué se quiere lograr y por qué.",
    "criteria": [
      "Botón «Pagar» visible en el checkout.",
      "Total con IVA calculado en centavos.",
      "Mensaje si el cobro falla, con opción de reintentar."
    ],
    "source": "https://empresa.atlassian.net/browse/PAY-123"
  },
  "problems": []
}
```

### Edge case

The first character in `input` is a visible BOM (`'\uFEFF'`). Each `\r\n` escape creates a CRLF line ending. The output is from running this exact input:

```ts
const input = '\uFEFF## Objetivo\r\nMeta CRLF.\r\n## Criterios de aceptación\r\n1. Acepta BOM y CRLF.';
await writeFile(join(root, 'edgeBomCrlf.md'), input);
console.log(JSON.stringify(await loadTask(root, 'edgeBomCrlf.md'), null, 2));
```

```json
{
  "task": {
    "file": "edgeBomCrlf.md",
    "objective": "Meta CRLF.",
    "criteria": [
      "Acepta BOM y CRLF."
    ]
  },
  "problems": []
}
```

### Without the key line

This input has an objective but no `## Acceptance criteria` section. The returned problem is complete:

```ts
const input = '## Objetivo\nMeta sin criterios.';
await writeFile(join(root, 'noCriteria.md'), input);
console.log(JSON.stringify(await loadTask(root, 'noCriteria.md'), null, 2));
```

```json
{
  "problems": [
    {
      "level": "error",
      "file": "noCriteria.md",
      "message": "acceptance criteria must be a numbered list"
    }
  ]
}
```

### Unknown section

The loader ignores the text under an unknown heading and reports a warning:

```ts
const input = '## Objetivo\nMeta.\n## Criterios de aceptación\n1. Uno.\n## Contexto adicional\nIgnorado.';
await writeFile(join(root, 'unknownSection.md'), input);
console.log(JSON.stringify(await loadTask(root, 'unknownSection.md'), null, 2));
```

```json
{
  "task": {
    "file": "unknownSection.md",
    "objective": "Meta.",
    "criteria": [
      "Uno."
    ]
  },
  "problems": [
    {
      "level": "warning",
      "file": "unknownSection.md",
      "message": "unknown section: Contexto adicional"
    }
  ]
}
```

### Heading with a final colon

The known `## Objective:` heading is recognized and returns no problems:

```ts
const input = '## Objetivo:\nMeta con dos puntos.\n## Criterios de aceptación\n1. Uno.';
await writeFile(join(root, 'colonHeading.md'), input);
console.log(JSON.stringify(await loadTask(root, 'colonHeading.md'), null, 2));
```

```json
{
  "task": {
    "file": "colonHeading.md",
    "objective": "Meta con dos puntos.",
    "criteria": [
      "Uno."
    ]
  },
  "problems": []
}
```

## Behavior summary

- **Unknown YAML field:** adds a warning and may still return the task.
- **Unknown section:** adds a warning and ignores its text.
- **Repeated section:** adds an error and omits the task.
- **Empty optional section:** is absent from the returned task.
- **Notes and decisions:** is recognized and returned as `task.notes`.
- **Malformed YAML or invalid source:** adds an error and omits the task.
- **Task file path:** is repository-relative with `/`, or absolute when outside the root.
- **Missing task file:** reports an error containing the path as received.

## Where it is used

### Uses

- [040-config-frontmatter.md](040-config-frontmatter.md), for YAML frontmatter parsing.
- [060-config-types.md](060-config-types.md), for the `Problem` type.

### Used by

- [src/config/task.test.ts](../../../src/config/task.test.ts), which imports `loadTask` at line 5. No production file calls it today.

## Tests

- `src/config/task.test.ts`: Spanish and English headings, including `Notes and decisions`, both generated templates, and optional sections.
- `src/config/task.test.ts`: objective and numbered-criteria validation, including continuation lines.
- `src/config/task.test.ts`: fenced code, unknown and duplicate sections, and malformed YAML.
- `src/config/task.test.ts`: BOM, CRLF, relative and outside-root paths, and missing files.

Part 3 · Page 13 of 23 · Previous: [Rule loader](080-config-rules.md) · Next: [Read-only Git interface](100-git-git.md) · [Index](../README.md)
