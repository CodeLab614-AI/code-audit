Parte 3 · Página 27 de 34 · Anterior: [Esquema de hallazgos](210-findings-schema.md) · Siguiente: [Modelo del informe](230-report-model.md) · [Índice](../README.md)
# Validador de hallazgos

**Archivo:** `src/findings/validate.ts` · 654 líneas · **Estado:** disponible

## Índice de la página

- ¿Qué es y para qué sirve?
- Antes de leer el código
- Cómo encaja
- El código completo, comentado
- Ejemplos con datos reales
- Resumen de comportamientos
- Dónde se usa
- Pruebas

## ¿Qué es y para qué sirve?

Valida y normaliza el archivo de hallazgos generado por las sesiones de revisión antes de compilar el informe final.

Sin esta función, cualquier error en las rutas, líneas inexistentes o citas alteradas provocaría enlaces rotos y datos erróneos en los informes generados.

Recibe el contenido en texto sin procesar o datos analizados (JSON), junto con el contexto del proyecto: la raíz del repositorio, las reglas elegidas y la ficha de tarea opcional. Devuelve una estructura con los datos válidos ordenados, la lista de hallazgos descartados con su motivo exacto y notas sobre campos opcionales ajustados.

Hoy ningún comando de la línea de comandos la usa directamente; en la siguiente etapa del plan la invocará el comando de finalización de revisión (review finish).

## Antes de leer el código

### Verificación de límites en el sistema de archivos

Para evitar que enlaces simbólicos o rutas relativas accedan a archivos fuera del proyecto, se comprueba la ruta real canónica (realpath) contra la raíz del repositorio.

```ts
// ruta dentro del repositorio
// → '../outside.ts' descartada con invalid path
```

Esto previene fugas de información y referencias a archivos externos.

### Normalización de citas multilínea

Antes de verificar la existencia de una cita, se eliminan espacios redundantes y tabuladores en cada línea tanto del archivo como de la cita recibida.

```ts
// archivo: '	const total = 1.16;
'
// cita: 'const total = 1.16;'
// → coincidencia exacta tras normalizar
```

Garantiza que variaciones menores de espaciado o saltos de línea de Windows (CRLF) no descarten hallazgos legítimos.

## Cómo encaja

```mermaid
flowchart TD
    Raw["findings.json"] --> Validate["validateFindings"]
    Context["root, rules, task"] --> Validate
    Validate --> Data["data: FindingsData"]
    Validate --> Discarded["discarded: DiscardedFinding[]"]
    Validate --> Notes["notes: string[]"]
```

1. Recibe el texto de hallazgos y lo analiza como JSON tras descartar marcas BOM si existen.
2. Comprueba que cumpla las condiciones estructurales obligatorias (versión 1, objeto, lista de hallazgos y resumen).
3. Evalúa cada hallazgo comprobando existencia de archivos, rangos de líneas y correspondencia de la cita.
4. Resuelve referencias cruzadas entre hallazgos y criterios de la tarea.
5. Ordena los hallazgos válidos por gravedad, archivo y línea, y devuelve el resultado normalizado.

## El código completo, comentado

El archivo contiene 653 líneas y se presenta en bloques consecutivos sin omitir ninguna línea.

### Bloque 1: Importaciones, clase de error y utilidades de texto

```ts
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { SEVERITIES } from '../config/rules.js';
import type { Task } from '../config/task.js';
import type { Severity } from '../config/types.js';
import type { SelectedRule } from '../review/select.js';
import {
  FINDINGS_SCHEMA_VERSION,
  type CriterionResult,
  type DiscardedFinding,
  type Finding,
  type FindingsData,
  type OutOfScope,
  type SuggestedRule,
} from './schema.js';

/** Error thrown when a findings file cannot be parsed or accepted as a whole. */
export class FindingsInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FindingsInvalidError';
  }
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

/** Compares strings by Unicode code units for deterministic ordering. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Parses raw file content into separate lines without trailing carriage returns. */
function parseLines(content: string): string[] {
  if (content === '') return [];
  const normalized = content.endsWith('\n') ? content.slice(0, -1) : content;
  if (normalized === '') return [];
  return normalized.split('\n').map((line) => line.replace(/\r$/, ''));
}

/** Checks whether a path is safely repository-relative without invalid segments or backslashes. */
function isValidRelativePath(path: string): boolean {
  if (typeof path !== 'string' || path.trim() === '') return false;
```

### Bloque 2: Validación de rutas y existencia de archivos en el repositorio

```ts
  if (path.includes('\\')) return false;
  if (isAbsolute(path) || path.startsWith('/')) return false;
  const segments = path.split('/');
  for (const seg of segments) {
    if (seg === '' || seg === '.' || seg === '..' || seg.toLowerCase() === '.git') {
      return false;
    }
  }
  return true;
}

/** Validates that a path exists as a regular file and does not escape the repository root. */
async function checkRepoFile(
  root: string,
  relPath: string,
): Promise<{ valid: boolean; reason?: string; fullPath?: string }> {
  if (!isValidRelativePath(relPath)) {
    return { valid: false, reason: `invalid path: ${relPath}` };
  }
  const full = resolve(root, relPath);
  let realRoot: string;
  try {
    realRoot = await realpath(root);
  } catch (err) {
    throw err;
  }
  let realFile: string;
  let fileStat;
  try {
    fileStat = await stat(full);
    realFile = await realpath(full);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { valid: false, reason: `file not found: ${relPath}` };
    }
    throw err;
  }
  if (!fileStat.isFile()) {
    return { valid: false, reason: `file not found: ${relPath}` };
  }
  const relToRealRoot = relative(realRoot, realFile);
  if (relToRealRoot === '..' || relToRealRoot.startsWith(`..${sep}`) || isAbsolute(relToRealRoot)) {
    return { valid: false, reason: `invalid path: ${relPath}` };
  }
  return { valid: true, fullPath: full };
}

/** Constructs a normalized DiscardedFinding entry with positional fallback values. */
function makeDiscardedFinding(item: unknown, position: number, reason: string): DiscardedFinding {
  if (item !== null && typeof item === 'object') {
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' && rec.id.trim().length > 0 ? rec.id.trim() : `#${position}`;
    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    return { id, title, reason };
  }
  return { id: `#${position}`, title: '', reason };
}

interface IntermediateFinding {
  finding: Finding;
  rawRelatedFindings: string[];
  rawRelatedCriteria: number[];
```

### Bloque 3: Construcción de descartes y comprobación de estructura global

```ts
  inputIndex: number;
}

/** Validates, normalizes, and filters findings dataset against repository files, rules, and task. */
export async function validateFindings(
  raw: unknown,
  ctx: { root: string; rules: SelectedRule[]; task?: Task },
): Promise<{ data: FindingsData; discarded: DiscardedFinding[]; notes: string[] }> {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const stripped = raw.replace(/^\uFEFF/, '');
    try {
      parsed = JSON.parse(stripped);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new FindingsInvalidError(`findings content is not valid JSON: ${detail}`);
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FindingsInvalidError('findings data must be an object');
  }

  const record = parsed as Record<string, unknown>;
  if (record.schema_version !== 1) {
    throw new FindingsInvalidError('schema_version must be 1');
  }
  if (!Array.isArray(record.findings)) {
    throw new FindingsInvalidError('findings must be an array');
  }
  if (typeof record.summary !== 'string') {
    throw new FindingsInvalidError('summary must be a string');
  }

  const notes: string[] = [];
  const programDiscarded: DiscardedFinding[] = [];
  const fileCache = new Map<string, string[]>();
  const seenIds = new Set<string>();
  const intermediateFindings: IntermediateFinding[] = [];

  for (let i = 0; i < record.findings.length; i++) {
    const position = i + 1;
    const rawItem = record.findings[i];
    if (rawItem === null || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      programDiscarded.push(makeDiscardedFinding(rawItem, position, 'finding is not an object'));
      continue;
    }

    const item = rawItem as Record<string, unknown>;

    if (typeof item.id !== 'string' || item.id.trim().length === 0) {
      programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: id'));
      continue;
    }

    const trimmedId = item.id.trim();
    const lowerId = trimmedId.toLowerCase();
    if (seenIds.has(lowerId)) {
      programDiscarded.push(makeDiscardedFinding(item, position, `duplicate id: ${trimmedId}`));
      continue;
    }
    seenIds.add(lowerId);

    if (typeof item.title !== 'string' || item.title.trim().length === 0) {
      programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: title'));
      continue;
    }

    if (typeof item.file !== 'string' || item.file.trim().length === 0) {
      programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: file'));
      continue;
    }

    if (typeof item.impact !== 'string' || item.impact.trim().length === 0) {
      programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: impact'));
      continue;
    }

    if (item.severity === undefined || typeof item.severity !== 'string') {
```

### Bloque 4: Bucle de hallazgos: identificador, campos obligatorios y reglas

```ts
      programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: severity'));
      continue;
    }

    const mappedSeverity = SEVERITIES[item.severity.trim().toLowerCase()];
    if (!mappedSeverity) {
      programDiscarded.push(makeDiscardedFinding(item, position, `invalid severity: ${item.severity.trim()}`));
      continue;
    }

    const wholeFile = item.whole_file === true;
    let line: number | undefined;
    let endLine: number | undefined;

    if (!wholeFile) {
      if (item.line === undefined || typeof item.line !== 'number' || !Number.isInteger(item.line) || item.line < 1) {
        programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: line'));
        continue;
      }
      line = item.line;

      if (item.end_line === undefined || item.end_line === null) {
        endLine = line;
      } else if (typeof item.end_line !== 'number' || !Number.isInteger(item.end_line) || item.end_line < 1) {
        programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: end_line'));
        continue;
      } else {
        endLine = item.end_line;
      }

      if (endLine < line) {
        programDiscarded.push(makeDiscardedFinding(item, position, 'end_line is before line'));
        continue;
      }

      if (typeof item.quote !== 'string' || item.quote.trim().length === 0) {
        programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: quote'));
        continue;
      }
    } else {
      if (typeof item.quote !== 'string' || item.quote.trim().length === 0) {
        programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: quote'));
        continue;
      }
    }

    let canonicalRuleId: string | undefined;
    if (item.rule_id !== undefined && item.rule_id !== null) {
      if (typeof item.rule_id !== 'string') {
        programDiscarded.push(makeDiscardedFinding(item, position, `rule ${item.rule_id} is not among the selected rules`));
        continue;
      }
      const trimmedRuleId = item.rule_id.trim();
      const matched = ctx.rules.find((r) => r.rule.id.toLowerCase() === trimmedRuleId.toLowerCase());
      if (!matched) {
        programDiscarded.push(makeDiscardedFinding(item, position, `rule ${trimmedRuleId} is not among the selected rules`));
        continue;
      }
      canonicalRuleId = matched.rule.id;
    }

    const fileCheck = await checkRepoFile(ctx.root, item.file.trim());
    if (!fileCheck.valid) {
      programDiscarded.push(makeDiscardedFinding(item, position, fileCheck.reason!));
      continue;
    }

    let fileLines = fileCache.get(item.file.trim());
    if (fileLines === undefined) {
      const content = await readFile(fileCheck.fullPath!, 'utf8');
      fileLines = parseLines(content);
      fileCache.set(item.file.trim(), fileLines);
    }
    const totalLines = fileLines.length;

    if (!wholeFile && line !== undefined && endLine !== undefined) {
      if (line > totalLines) {
        programDiscarded.push(
          makeDiscardedFinding(item, position, `line ${line} is outside ${item.file.trim()} (${totalLines} lines)`),
        );
        continue;
      }
      if (endLine > totalLines) {
        programDiscarded.push(
          makeDiscardedFinding(item, position, `line ${endLine} is outside ${item.file.trim()} (${totalLines} lines)`),
        );
        continue;
      }

      const quoteLinesRaw = (item.quote as string).split('\n');
      while (quoteLinesRaw.length > 0 && quoteLinesRaw[0].trim() === '') {
        quoteLinesRaw.shift();
      }
      while (quoteLinesRaw.length > 0 && quoteLinesRaw[quoteLinesRaw.length - 1].trim() === '') {
        quoteLinesRaw.pop();
      }
      if (quoteLinesRaw.length === 0) {
        programDiscarded.push(makeDiscardedFinding(item, position, 'missing or invalid field: quote'));
        continue;
      }
      const normQuote = quoteLinesRaw.map((l) => l.trim().replace(/[ \t]+/g, ' ')).join('\n');
      const fileSlice = fileLines.slice(line - 1, endLine);
      const normFile = fileSlice.map((l) => l.trim().replace(/[ \t]+/g, ' ')).join('\n');
      if (!normFile.includes(normQuote)) {
        programDiscarded.push(
          makeDiscardedFinding(item, position, `quote not found in ${item.file.trim()} at lines ${line}-${endLine}`),
        );
        continue;
      }
    }

    let suggestion: { startLine: number; code: string } | undefined;
    if (item.suggestion !== undefined && item.suggestion !== null) {
      if (typeof item.suggestion === 'object' && !Array.isArray(item.suggestion)) {
        const sug = item.suggestion as Record<string, unknown>;
        const startLine = sug.start_line;
        const code = sug.code;
        if (
          typeof startLine === 'number'
          && Number.isInteger(startLine)
          && startLine >= 1
          && startLine <= totalLines
          && typeof code === 'string'
        ) {
          suggestion = { startLine, code };
        } else {
          notes.push(`invalid suggestion in finding ${trimmedId}, removed`);
        }
      } else {
        notes.push(`invalid suggestion in finding ${trimmedId}, removed`);
      }
    }
```

### Bloque 5: Bucle de hallazgos: comprobación de líneas, cita y campos opcionales

```ts

    let existing: { file: string; line?: number; note: string } | undefined;
    if (item.existing !== undefined && item.existing !== null) {
      if (typeof item.existing === 'object' && !Array.isArray(item.existing)) {
        const ex = item.existing as Record<string, unknown>;
        if (typeof ex.file === 'string' && typeof ex.note === 'string') {
          const exCheck = await checkRepoFile(ctx.root, ex.file.trim());
          let exLineValid = true;
          let exLine: number | undefined;
          if (exCheck.valid) {
            let exLines = fileCache.get(ex.file.trim());
            if (exLines === undefined) {
              const exContent = await readFile(exCheck.fullPath!, 'utf8');
              exLines = parseLines(exContent);
              fileCache.set(ex.file.trim(), exLines);
            }
            if (ex.line !== undefined && ex.line !== null) {
              if (
                typeof ex.line === 'number'
                && Number.isInteger(ex.line)
                && ex.line >= 1
                && ex.line <= exLines.length
              ) {
                exLine = ex.line;
              } else {
                exLineValid = false;
              }
            }
          } else {
            exLineValid = false;
          }
          if (exCheck.valid && exLineValid) {
            existing = { file: ex.file.trim(), line: exLine, note: ex.note };
          } else {
            notes.push(`invalid existing reference in finding ${trimmedId}, removed`);
          }
        } else {
          notes.push(`invalid existing reference in finding ${trimmedId}, removed`);
        }
      } else {
        notes.push(`invalid existing reference in finding ${trimmedId}, removed`);
      }
    }

    let verified = false;
    if (item.verified !== undefined && item.verified !== null) {
      if (typeof item.verified === 'boolean') {
        verified = item.verified;
      } else {
        verified = false;
        notes.push(`invalid type for verified in finding ${trimmedId}, defaulting to false`);
      }
    }

    let relatedNote: string | undefined;
    if (item.related_note !== undefined && item.related_note !== null) {
      if (typeof item.related_note === 'string') {
        relatedNote = item.related_note;
      } else {
        notes.push(`invalid related_note in finding ${trimmedId}, removed`);
      }
    }

    let rawRelatedFindings: string[] = [];
    if (item.related_findings !== undefined && item.related_findings !== null) {
      if (Array.isArray(item.related_findings) && item.related_findings.every((rf) => typeof rf === 'string')) {
        rawRelatedFindings = item.related_findings;
      } else {
        notes.push(`invalid related_findings in finding ${trimmedId}, removed`);
      }
    }

    let rawRelatedCriteria: number[] = [];
    if (item.related_criteria !== undefined && item.related_criteria !== null) {
      if (Array.isArray(item.related_criteria) && item.related_criteria.every((rc) => typeof rc === 'number' && Number.isInteger(rc))) {
        rawRelatedCriteria = item.related_criteria;
      } else {
        notes.push(`invalid related_criteria in finding ${trimmedId}, removed`);
      }
    }

    const finding: Finding = {
      id: trimmedId,
      title: item.title.trim(),
      severity: mappedSeverity,
      file: item.file.trim(),
      quote: item.quote as string,
      impact: item.impact.trim(),
      verified,
      wholeFile,
      line,
      endLine,
      suggestion,
      ruleId: canonicalRuleId,
      relatedFindings: [],
      relatedCriteria: [],
      relatedNote,
      existing,
    };

    intermediateFindings.push({
      finding,
      rawRelatedFindings,
      rawRelatedCriteria,
      inputIndex: i,
    });
  }

  const keptIds = new Map<string, string>();
  for (const entry of intermediateFindings) {
    keptIds.set(entry.finding.id.toLowerCase(), entry.finding.id);
  }

  for (const entry of intermediateFindings) {
    const resolvedFindings: string[] = [];
    for (const ref of entry.rawRelatedFindings) {
      const canonical = keptIds.get(ref.trim().toLowerCase());
      if (
        canonical !== undefined
        && canonical.toLowerCase() !== entry.finding.id.toLowerCase()
        && !resolvedFindings.includes(canonical)
      ) {
        resolvedFindings.push(canonical);
      }
    }
    entry.finding.relatedFindings = resolvedFindings;

    const resolvedCriteria: number[] = [];
    if (ctx.task) {
      for (const num of entry.rawRelatedCriteria) {
        if (num >= 1 && num <= ctx.task.criteria.length && !resolvedCriteria.includes(num)) {
          resolvedCriteria.push(num);
        }
      }
    }
    entry.finding.relatedCriteria = resolvedCriteria;
  }

  intermediateFindings.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.finding.severity] - SEVERITY_ORDER[b.finding.severity];
    if (sevDiff !== 0) return sevDiff;
    const fileDiff = compareText(a.finding.file, b.finding.file);
    if (fileDiff !== 0) return fileDiff;
    if (a.finding.wholeFile && !b.finding.wholeFile) return -1;
    if (!a.finding.wholeFile && b.finding.wholeFile) return 1;
    const lineDiff = (a.finding.line ?? 0) - (b.finding.line ?? 0);
    if (lineDiff !== 0) return lineDiff;
    return a.inputIndex - b.inputIndex;
  });

  const sortedFindings = intermediateFindings.map((entry) => entry.finding);

  const criteriaResults: CriterionResult[] = [];
  if (ctx.task) {
    const rawCriteriaMap = new Map<number, { status: 'met' | 'partial' | 'not_met'; reason?: string }>();
    if (record.criteria !== undefined && record.criteria !== null) {
      if (!Array.isArray(record.criteria)) {
```

### Bloque 6: Resolución de relaciones cruzadas y ordenación determinista

```ts
        notes.push('criteria must be an array, ignored');
      } else {
        for (const rawCriterion of record.criteria) {
          if (rawCriterion === null || typeof rawCriterion !== 'object' || Array.isArray(rawCriterion)) {
            notes.push('criterion entry must be an object, ignored');
            continue;
          }
          const c = rawCriterion as Record<string, unknown>;
          const num = c.number;
          const status = c.status;
          const reason = typeof c.reason === 'string' ? c.reason : undefined;
          if (
            typeof num !== 'number'
            || !Number.isInteger(num)
            || num < 1
            || num > ctx.task.criteria.length
            || (status !== 'met' && status !== 'partial' && status !== 'not_met')
            || (c.reason !== undefined && c.reason !== null && typeof c.reason !== 'string')
          ) {
            notes.push(`invalid criterion entry ${JSON.stringify(c)}, ignored`);
            continue;
          }
          if (rawCriteriaMap.has(num)) {
            notes.push(`duplicate criterion number ${num}, first entry retained`);
            continue;
          }
          rawCriteriaMap.set(num, { status, reason });
        }
      }
    }

    for (let idx = 0; idx < ctx.task.criteria.length; idx++) {
      const num = idx + 1;
      const text = ctx.task.criteria[idx];
      const match = rawCriteriaMap.get(num);
      if (match) {
        const item: CriterionResult = { number: num, text, status: match.status };
        if (match.reason !== undefined) item.reason = match.reason;
        criteriaResults.push(item);
      } else {
        criteriaResults.push({ number: num, text, status: 'not_evaluated' });
      }
    }
  }

  const outOfScope: OutOfScope[] = [];
  if (record.out_of_scope !== undefined && record.out_of_scope !== null) {
    if (!Array.isArray(record.out_of_scope)) {
      notes.push('out_of_scope must be an array, ignored');
    } else {
      for (const item of record.out_of_scope) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          notes.push('out_of_scope entry must be an object, ignored');
          continue;
        }
        const oos = item as Record<string, unknown>;
        if (typeof oos.file !== 'string' || typeof oos.note !== 'string') {
          notes.push(`invalid out_of_scope entry ${JSON.stringify(oos)}, ignored`);
          continue;
        }
        const oosCheck = await checkRepoFile(ctx.root, oos.file.trim());
```

### Bloque 7: Normalización de criterios de la tarea

```ts
        if (!oosCheck.valid) {
          notes.push(`invalid out_of_scope file "${oos.file}": ${oosCheck.reason}, ignored`);
          continue;
        }
        let oosLine: number | undefined;
        if (oos.line !== undefined && oos.line !== null) {
          let oosLines = fileCache.get(oos.file.trim());
          if (oosLines === undefined) {
            const oosContent = await readFile(oosCheck.fullPath!, 'utf8');
            oosLines = parseLines(oosContent);
            fileCache.set(oos.file.trim(), oosLines);
          }
          if (
            typeof oos.line === 'number'
            && Number.isInteger(oos.line)
            && oos.line >= 1
            && oos.line <= oosLines.length
          ) {
            oosLine = oos.line;
          } else {
            notes.push(`line ${oos.line} is outside ${oos.file} in out_of_scope, ignored`);
            continue;
          }
        }
        outOfScope.push({ file: oos.file.trim(), line: oosLine, note: oos.note });
      }
    }
  }

  let ideas: string[] = [];
  if (record.ideas !== undefined && record.ideas !== null) {
    if (!Array.isArray(record.ideas)) {
      notes.push('ideas must be an array, ignored');
    } else {
      const validIdeas = record.ideas.filter((i): i is string => typeof i === 'string');
      if (validIdeas.length > 5) {
        ideas = validIdeas.slice(0, 5);
        notes.push(`retained first 5 ideas (received ${validIdeas.length})`);
      } else {
        ideas = validIdeas;
      }
    }
  }

  let impact: string[] = [];
  if (record.impact !== undefined && record.impact !== null) {
    if (!Array.isArray(record.impact)) {
```

### Bloque 8: Normalización de colecciones auxiliares y retorno

```ts
      notes.push('impact must be an array, ignored');
    } else {
      impact = record.impact.filter((i): i is string => typeof i === 'string');
    }
  }

  const suggestedRules: SuggestedRule[] = [];
  if (record.suggested_rules !== undefined && record.suggested_rules !== null) {
    if (!Array.isArray(record.suggested_rules)) {
      notes.push('suggested_rules must be an array, ignored');
    } else {
      for (const item of record.suggested_rules) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          notes.push('suggested_rules entry must be an object, ignored');
          continue;
        }
        const sr = item as Record<string, unknown>;
        if (typeof sr.text !== 'string') {
          notes.push('suggested_rules entry missing text, ignored');
          continue;
        }
        const ruleEntry: SuggestedRule = { text: sr.text };
        if (typeof sr.from_finding === 'string') {
          const matchedTarget = keptIds.get(sr.from_finding.trim().toLowerCase());
          if (matchedTarget) {
            ruleEntry.fromFinding = matchedTarget;
          }
        }
        suggestedRules.push(ruleEntry);
      }
    }
  }

  const inputDiscarded: DiscardedFinding[] = [];
  if (record.discarded !== undefined && record.discarded !== null) {
    if (!Array.isArray(record.discarded)) {
      notes.push('discarded must be an array, ignored');
    } else {
      for (let i = 0; i < record.discarded.length; i++) {
        const item = record.discarded[i];
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const d = item as Record<string, unknown>;
          const id = typeof d.id === 'string' && d.id.trim().length > 0 ? d.id.trim() : `#${i + 1}`;
          const title = typeof d.title === 'string' ? d.title.trim() : '';
          const reason = typeof d.reason === 'string' ? d.reason : '';
          inputDiscarded.push({ id, title, reason });
        } else {
          inputDiscarded.push({ id: `#${i + 1}`, title: '', reason: '' });
        }
      }
    }
  }

  return {
    data: {
      schemaVersion: FINDINGS_SCHEMA_VERSION,
      summary: record.summary as string,
      criteria: criteriaResults,
      findings: sortedFindings,
      outOfScope,
      ideas,
      suggestedRules,
      impact,
      discarded: inputDiscarded,
    },
    discarded: programDiscarded,
    notes,
  };
}

```

## Ejemplos con datos reales

### Ejemplo 1: Caso normal del plan con 0 descartados

Entrada:

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
      "related_criteria": [
        2
      ],
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

Salida:

```json
{
  "data": {
    "schemaVersion": 1,
    "summary": "Tres líneas como máximo: qué hizo el cambio y qué está mal.",
    "criteria": [
      {
        "number": 1,
        "text": "Botón «Pagar» visible en el checkout.",
        "status": "not_evaluated"
      },
      {
        "number": 2,
        "text": "Total con IVA calculado en centavos.",
        "status": "not_met",
        "reason": "Lo calcula con decimales."
      },
      {
        "number": 3,
        "text": "Mensaje si el cobro falla, con opción de reintentar.",
        "status": "not_evaluated"
      }
    ],
    "findings": [
      {
        "id": "F1",
        "title": "El total se calcula con decimales y puede cobrar mal",
        "severity": "critical",
        "file": "src/billing/total.ts",
        "quote": "const total = price * 1.16",
        "impact": "Qué pasaría en la práctica.",
        "verified": true,
        "wholeFile": false,
        "line": 41,
        "endLine": 41,
        "suggestion": {
          "startLine": 40,
          "code": "const priceCents = item.priceCents\n…"
        },
        "ruleId": "BIZ-003",
        "relatedFindings": [],
        "relatedCriteria": [
          2
        ],
        "relatedNote": "Se resuelve también con el problema 3.",
        "existing": {
          "file": "src/ui/Button.tsx",
          "line": 1,
          "note": "Botón con estado «cargando»."
        }
      }
    ],
    "outOfScope": [
      {
        "file": "src/auth/session.ts",
        "line": 88,
        "note": "Sesiones de usuario."
      }
    ],
    "ideas": [
      "El cálculo del IVA está repetido en dos lugares."
    ],
    "suggestedRules": [
      {
        "text": "Todo botón que cobre se desactiva mientras espera.",
        "fromFinding": "F1"
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
  },
  "discarded": [],
  "notes": []
}
```

### Ejemplo 2: Cita equivocada en el hallazgo

Entrada:

```json
{
  "schema_version": 1,
  "summary": "Revisión con cita incorrecta.",
  "findings": [
    {
      "id": "F1",
      "title": "Error de cálculo",
      "severity": "critical",
      "file": "src/billing/total.ts",
      "line": 41,
      "end_line": 41,
      "quote": "const total = price * 1.15",
      "impact": "Cálculo incorrecto"
    }
  ]
}
```

Salida:

```json
{
  "data": {
    "schemaVersion": 1,
    "summary": "Revisión con cita incorrecta.",
    "criteria": [
      {
        "number": 1,
        "text": "Botón «Pagar» visible en el checkout.",
        "status": "not_evaluated"
      },
      {
        "number": 2,
        "text": "Total con IVA calculado en centavos.",
        "status": "not_evaluated"
      },
      {
        "number": 3,
        "text": "Mensaje si el cobro falla, con opción de reintentar.",
        "status": "not_evaluated"
      }
    ],
    "findings": [],
    "outOfScope": [],
    "ideas": [],
    "suggestedRules": [],
    "impact": [],
    "discarded": []
  },
  "discarded": [
    {
      "id": "F1",
      "title": "Error de cálculo",
      "reason": "quote not found in src/billing/total.ts at lines 41-41"
    }
  ],
  "notes": []
}
```

### Ejemplo 3: Ruta fuera del repositorio

Entrada:

```json
{
  "schema_version": 1,
  "summary": "Revisión con ruta fuera del repositorio.",
  "findings": [
    {
      "id": "F1",
      "title": "Ruta no válida",
      "severity": "major",
      "file": "../outside.ts",
      "line": 1,
      "quote": "const x = 1;",
      "impact": "Ruta que escapa del proyecto"
    }
  ]
}
```

Salida:

```json
{
  "data": {
    "schemaVersion": 1,
    "summary": "Revisión con ruta fuera del repositorio.",
    "criteria": [
      {
        "number": 1,
        "text": "Botón «Pagar» visible en el checkout.",
        "status": "not_evaluated"
      },
      {
        "number": 2,
        "text": "Total con IVA calculado en centavos.",
        "status": "not_evaluated"
      },
      {
        "number": 3,
        "text": "Mensaje si el cobro falla, con opción de reintentar.",
        "status": "not_evaluated"
      }
    ],
    "findings": [],
    "outOfScope": [],
    "ideas": [],
    "suggestedRules": [],
    "impact": [],
    "discarded": []
  },
  "discarded": [
    {
      "id": "F1",
      "title": "Ruta no válida",
      "reason": "invalid path: ../outside.ts"
    }
  ],
  "notes": []
}
```

### Ejemplo 4: Criterios con estado not_evaluated

Entrada:

```json
{
  "schema_version": 1,
  "summary": "Revisión con evaluación parcial de criterios.",
  "criteria": [
    {
      "number": 1,
      "status": "met"
    }
  ],
  "findings": []
}
```

Salida:

```json
{
  "data": {
    "schemaVersion": 1,
    "summary": "Revisión con evaluación parcial de criterios.",
    "criteria": [
      {
        "number": 1,
        "text": "Botón «Pagar» visible en el checkout.",
        "status": "met"
      },
      {
        "number": 2,
        "text": "Total con IVA calculado en centavos.",
        "status": "not_evaluated"
      },
      {
        "number": 3,
        "text": "Mensaje si el cobro falla, con opción de reintentar.",
        "status": "not_evaluated"
      }
    ],
    "findings": [],
    "outOfScope": [],
    "ideas": [],
    "suggestedRules": [],
    "impact": [],
    "discarded": []
  },
  "discarded": [],
  "notes": []
}
```

### Ejemplo 5: Siete ideas recibidas

Entrada:

```json
{
  "schema_version": 1,
  "summary": "Revisión con siete ideas de mejora.",
  "findings": [],
  "ideas": [
    "Centralizar el cálculo del IVA en una sola función.",
    "Agregar validación estricta de esquemas antes del procesamiento.",
    "Documentar los tipos de moneda admitidos en el módulo de facturación.",
    "Separar la lógica de negocio de los componentes de interfaz.",
    "Incorporar pruebas de integración para reembolsos parciales.",
    "Configurar alertas automáticas para discrepancias en decimales.",
    "Añadir telemetría para medir la latencia del proceso de pago."
  ]
}
```

Salida:

```json
{
  "data": {
    "schemaVersion": 1,
    "summary": "Revisión con siete ideas de mejora.",
    "criteria": [
      {
        "number": 1,
        "text": "Botón «Pagar» visible en el checkout.",
        "status": "not_evaluated"
      },
      {
        "number": 2,
        "text": "Total con IVA calculado en centavos.",
        "status": "not_evaluated"
      },
      {
        "number": 3,
        "text": "Mensaje si el cobro falla, con opción de reintentar.",
        "status": "not_evaluated"
      }
    ],
    "findings": [],
    "outOfScope": [],
    "ideas": [
      "Centralizar el cálculo del IVA en una sola función.",
      "Agregar validación estricta de esquemas antes del procesamiento.",
      "Documentar los tipos de moneda admitidos en el módulo de facturación.",
      "Separar la lógica de negocio de los componentes de interfaz.",
      "Incorporar pruebas de integración para reembolsos parciales."
    ],
    "suggestedRules": [],
    "impact": [],
    "discarded": []
  },
  "discarded": [],
  "notes": [
    "retained first 5 ideas (received 7)"
  ]
}
```

## Resumen de comportamientos

- **Entrada no JSON o versión distinta de 1:** Lanza `FindingsInvalidError`.
- **Cita con caracteres distintos:** Descarta el hallazgo con `quote not found in <file> at lines <line>-<end_line>`.
- **Ruta que sale del repositorio o con enlaces externos:** Descarta el hallazgo con `invalid path: <file>`.
- **Archivos que inician con doble punto (`..`):** Nombres de archivo como `..foo.ts` dentro del repositorio se aceptan válidamente, restringiendo el descarte de ruta a aquellas que verdaderamente escapan de la raíz o usan enlaces simbólicos externos.
- **Archivo inexistente o ruta que apunta a directorio:** Descarta con `file not found: <file>`.
- **Línea mayor a la cantidad de líneas del archivo:** Descarta con `line <n> is outside <file> (<total> lines)`.
- **Campos opcionales con valor `null`:** En cualquier campo opcional (de hallazgo, nivel superior o elementos de listas), `null` se interpreta como omitido sin descartar ni emitir notas; únicamente `line: null` sin `whole_file` produce descarte por falta de `line`.
- **Identificador de hallazgo duplicado:** Descarta el segundo con `duplicate id: <id>`.
- **Regla no incluida entre las seleccionadas:** Descarta con `rule <rule_id> is not among the selected rules`.
- **Criterios sin evaluar:** Reciben el estado `not_evaluated` con el texto original de la tarea.
- **Más de cinco ideas:** Conserva las cinco primeras y anota la reducción en notas.

## Dónde se usa

- Usa: `node:fs/promises:1`, `node:path:2`, `src/config/rules.ts:9`, `src/config/task.ts:7`, `src/config/types.ts:3`, `src/review/select.ts:14` y `src/findings/schema.ts:4`.
- Lo usan: `src/findings/validate.test.ts:9`.
- Hoy ningún comando de la línea de comandos la usa directamente.

## Pruebas

- `src/findings/validate.test.ts`: valida el ejemplo del plan con 0 descartados, rechazo total del archivo, citas incorrectas, saltos CRLF y tabuladores, rutas fuera del repo, reglas no seleccionadas, alias de gravedad, citas multilínea, límite de ideas, marcas BOM, enlaces simbólicos externos, casos ENOTDIR, ordenación determinista y generación de identificadores posicionales.

Parte 3 · Página 27 de 34 · Anterior: [Esquema de hallazgos](210-findings-schema.md) · Siguiente: [Modelo del informe](230-report-model.md) · [Índice](../README.md)

