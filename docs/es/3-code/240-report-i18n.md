Parte 3 · Página 29 de 34 · Anterior: [Modelo del informe](230-report-model.md) · Siguiente: [Desarrollo](../4-development/10-development.md) · [Índice](../README.md)
# Textos fijos e idioma

**Archivo:** `src/report/i18n.ts` · 409 líneas · **Estado:** disponible

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

Define y centraliza todos los textos estáticos y funciones de formateo lingüístico para los informes en inglés y español. Sin este módulo, las vistas HTML y Markdown tendrían cadenas escritas directamente en sus plantillas, lo que provocaría discrepancias de redacción entre formatos, textos sin traducir y duplicación innecesaria al dar formato a fechas, rangos de Git y motivos de reglas.

Proporciona la función `resolveReportLanguage` para interpretar la preferencia de idioma del usuario con respaldo seguro en inglés, y la constante `TEXTS`, un catálogo estricto bilingüe donde cada entrada es una cadena fija o una función formateadora que recibe parámetros primitivos. Hoy ningún comando de la interfaz de terminal lo usa de forma directa; lo consume [`src/report/model.ts`](230-report-model.md) al ensamblar los datos del informe.

## Antes de leer el código

### Resolución de idioma y respaldo

Convierte cadenas de idioma arbitrarias en los dos códigos admitidos (`es` o `en`). Si el usuario solicita un idioma no soportado como francés (`fr`) o alemán (`de`), el sistema recurre al inglés y activa la bandera `fallback: true` para advertirlo en los detalles del informe.

```ts
// entrada: 'es-MX'
// → { ui: 'es', fallback: false }
// entrada: 'fr'
// → { ui: 'en', fallback: true }
```

### Formateo de fechas localizado

Descompone fechas mediante `Intl.DateTimeFormat` y las reconstruye con una función propia de cada idioma para asegurar un orden consistente entre diferentes versiones de Node.js.

```ts
// entrada: { day: '18', month: 'octubre', year: '2026', hour: '15', minute: '32' }
// → "18 de octubre de 2026, 15:32"
```

## Cómo encaja

```mermaid
flowchart TD
    langReq["Idioma solicitado (string)"] --> resolve["resolveReportLanguage"]
    resolve --> ui["ui ('en' | 'es') y fallback"]
    ui --> textsCatalog["Catálogo TEXTS[ui]"]
    textsCatalog --> model["src/report/model.ts"]
```

1. `resolveReportLanguage` limpia espacios y normaliza mayúsculas de la cadena de idioma.
2. Si coincide con español (`es` o prefijo `es-`), devuelve `ui: 'es'`. Si coincide con inglés (`en` o `en-`), devuelve `ui: 'en'`. Para cualquier otro caso, devuelve `ui: 'en'` con `fallback: true`.
3. `src/report/model.ts` selecciona el catálogo correspondiente de `TEXTS` y formatea las fechas, descripciones de rango, motivos de reglas y estados.

## El código completo, comentado

```ts
/** Components of a date used to format localized report timestamps. */
export interface ReportDateParts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
}

/** Parameters describing a review scope for formatted text sentences. */
export interface RangeDescriptionParams {
  branch: string | null;
  baseLabel: string;
  baseShort: string;
  headShort: string;
  commitsCount: number;
  uncommittedFilesCount: number;
  filesCount: number;
  added: number;
  removed: number;
}

/** Explicit catalog of all static and parameterized text strings for reports. */
export interface ReportTexts {
  stampApproved: string;
  stampNotApproved: string;
  verdictAria: (approved: boolean) => string;
  headerMeta: (taskId: string | undefined, branch: string | null, date: string) => string;
  titleWithoutTask: (target: string) => string;
  formatDate: (parts: ReportDateParts) => string;
  largeChangeWarning: string;
  sectionTaskTitle: string;
  criteriaMet: (met: number, total: number) => string;
  criteriaNoTask: string;
  criteriaNone: string;
  statusMet: string;
  statusNotMet: string;
  statusPartial: string;
  statusNotEvaluated: string;
  sectionIssuesTitle: string;
  issuesSub: (count: number) => string;
  severityCritical: string;
  severityCriticalDetail: string;
  severityMajor: string;
  severityMinor: string;
  markReviewed: string;
  codeToday: string;
  codeSuggestion: string;
  codeSuggestionDetail: string;
  codeSuggestionDetailShort: string;
  labelRule: string;
  labelOrigin: string;
  labelExisting: string;
  labelRelated: string;
  labelCertainty: string;
  ruleKindPolicy: string;
  ruleKindRule: string;
  ruleKindBusiness: string;
  ruleKindDecision: string;
  ruleKindTemplate: string;
  noRuleDefect: string;
  suggestedRuleBelowNote: string;
  confirmedByVerifier: string;
  unverified: string;
  quotedLineExists: string;
  fileExists: string;
  certainty: (verified: boolean, wholeFile: boolean) => string;
  wholeFileSummary: (lines: number) => string;
  fileLineLabel: (file: string, line?: number) => string;
  wholeFileLabel: (status: string, lines: number) => string;
  relatedCriterion: (num: number, statusText: string) => string;
  relatedFinding: (num: number, title: string) => string;
  sectionImpactTitle: string;
  sectionOutOfScopeTitle: string;
  outOfScopeNote: (file: string, line: number | undefined, note: string) => string;
  sectionIdeasTitle: string;
  ideasSub: string;
  sectionSuggestedRulesTitle: string;
  suggestedRuleText: (text: string, fromNumber?: number) => string;
  sectionDetailsTitle: string;
  editorSelectorLabel: string;
  editorOptions: {
    vscode: string;
    cursor: string;
    windsurf: string;
    jetbrains: string;
    zed: string;
    none: string;
  };
  rangeBranch: (params: RangeDescriptionParams) => string;
  rangeUnpushed: (params: RangeDescriptionParams) => string;
  rangeSinceRun: (params: RangeDescriptionParams) => string;
  rangeSinceRef: (params: RangeDescriptionParams) => string;
  rulesUsed: (selected: number, total: number) => string;
  reasonPolicy: string;
  reasonAppliesTo: (pattern: string, files: string[]) => string;
  reasonKeyword: (keyword: string, where: 'changes' | 'task') => string;
  importedSession: (file: string) => string;
  repoUnchanged: string;
  discardedByVerifier: (count: number) => string;
  discardedByValidation: (count: number) => string;
  languageFallbackNote: (lang: string) => string;
  fileStatusNew: string;
  fileStatusModified: string;
  fileStatusDeleted: string;
  fileStatusRenamed: string;
  fileProblems: (problems: number[]) => string;
  fileOutOfScope: string;
  fileNoProblems: string;
}

/** Resolves requested language into a supported UI code and fallback status. */
export function resolveReportLanguage(language: string): { ui: 'en' | 'es'; fallback: boolean } {
  const normalized = language.trim().toLowerCase();
  if (normalized === 'es' || normalized.startsWith('es-')) {
    return { ui: 'es', fallback: false };
  }
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return { ui: 'en', fallback: false };
  }
  return { ui: 'en', fallback: true };
}

/** Formats uncommitted file clause in Spanish. */
function formatUncommittedEs(count: number): string {
  if (count <= 0) return '';
  return ` y ${count} archivo${count === 1 ? '' : 's'} sin commit`;
}

/** Formats uncommitted file clause in English. */
function formatUncommittedEn(count: number): string {
  if (count <= 0) return '';
  return ` and ${count} uncommitted file${count === 1 ? '' : 's'}`;
}

/** Formats added and removed line counts in Spanish. */
function formatLinesEs(added: number, removed: number): string {
  const addedText = added === 1 ? '1 línea agregada' : `${added} líneas agregadas`;
  const removedText = removed === 1 ? '1 quitada' : `${removed} quitadas`;
  return `${addedText} y ${removedText}.`;
}

/** Formats added and removed line counts in English. */
function formatLinesEn(added: number, removed: number): string {
  const addedText = added === 1 ? '1 line added' : `${added} lines added`;
  return `${addedText} and ${removed} removed.`;
}

const TEXTS_ES: ReportTexts = {
  stampApproved: 'Aprobado',
  stampNotApproved: 'No aprobado',
  verdictAria: (approved) => `Veredicto: ${approved ? 'aprobado' : 'no aprobado'}`,
  headerMeta: (taskId, branch, date) =>
    taskId
      ? `Tarea ${taskId}${branch ? `, rama ${branch}` : ''}. Revisado el ${date}.`
      : `${branch ? `Rama ${branch}. ` : ''}Revisado el ${date}.`,
  titleWithoutTask: (target) => `Revisión de ${target}`,
  formatDate: ({ day, month, year, hour, minute }) => `${day} de ${month} de ${year}, ${hour}:${minute}`,
  largeChangeWarning: 'cambio grande: conviene dividirlo en el futuro',
  sectionTaskTitle: '¿Hizo lo que pedía la tarea?',
  criteriaMet: (met, total) =>
    `${met} de ${total} ${total === 1 ? 'criterio cumplido' : 'criterios cumplidos'}.`,
  criteriaNoTask: 'sin tarea: no evaluado',
  criteriaNone: 'La tarea no tiene criterios.',
  statusMet: 'Cumplido',
  statusNotMet: 'No cumplido',
  statusPartial: 'A medias',
  statusNotEvaluated: 'No evaluado',
  sectionIssuesTitle: 'Lo que tienes que revisar',
  issuesSub: (count) =>
    `${count} problema${count === 1 ? '' : 's'}. Marca cada uno cuando lo hayas visto; la marca se guarda en este navegador.`,
  severityCritical: 'Grave',
  severityCriticalDetail: 'Grave, impide aprobar',
  severityMajor: 'Importante',
  severityMinor: 'Menor',
  markReviewed: 'Ya lo revisé',
  codeToday: 'Hoy',
  codeSuggestion: 'Podría quedar así',
  codeSuggestionDetail: '(sugerencia, el revisor no cambia nada)',
  codeSuggestionDetailShort: '(sugerencia)',
  labelRule: 'Regla',
  labelOrigin: 'Origen',
  labelExisting: 'Ya existe',
  labelRelated: 'Relacionado',
  labelCertainty: 'Certeza',
  ruleKindPolicy: 'políticas, nunca se rompe',
  ruleKindRule: 'regla',
  ruleKindBusiness: 'negocio',
  ruleKindDecision: 'decisión',
  ruleKindTemplate: 'plantilla',
  noRuleDefect: 'Error de funcionamiento; ninguna regla lo cubre.',
  suggestedRuleBelowNote: 'Abajo se sugiere una regla nueva.',
  confirmedByVerifier: 'Confirmado por el verificador.',
  unverified: 'Sin verificar.',
  quotedLineExists: 'La línea citada existe y dice esto.',
  fileExists: 'El archivo existe.',
  certainty: (verified, wholeFile) =>
    `${verified ? 'Confirmado por el verificador.' : 'Sin verificar.'} ${
      wholeFile ? 'El archivo existe.' : 'La línea citada existe y dice esto.'
    }`,
  wholeFileSummary: (lines) => `Ver el archivo completo (${lines} líneas)`,
  fileLineLabel: (file, line) => (line !== undefined ? `${file}, línea ${line}` : file),
  wholeFileLabel: (status, lines) => `archivo completo (${status ? `${status}, ` : ''}${lines} líneas)`,
  relatedCriterion: (num, statusText) => `Criterio ${num} de la tarea, ${statusText.toLowerCase()}.`,
  relatedFinding: (num, title) => `Problema ${num}: ${title}`,
  sectionImpactTitle: 'Qué más puede romperse',
  sectionOutOfScopeTitle: 'Cambios fuera de la tarea',
  outOfScopeNote: (file, line, note) =>
    `Modificó ${file}${line !== undefined ? ` en la línea ${line}` : ''} (${note}). Decide si se queda en esta rama o va en una aparte.`,
  sectionIdeasTitle: 'Ideas para mejorar',
  ideasSub: 'Opcionales. No cuentan para el veredicto.',
  sectionSuggestedRulesTitle: 'Regla nueva sugerida',
  suggestedRuleText: (text, fromNumber) =>
    fromNumber !== undefined ? `«${text}». Sale del problema ${fromNumber}.` : `«${text}».`,
  sectionDetailsTitle: 'Detalles de la revisión',
  editorSelectorLabel: 'Editor:',
  editorOptions: {
    vscode: 'VS Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    jetbrains: 'JetBrains',
    zed: 'Zed',
    none: 'Ninguno',
  },
  rangeBranch: (params) =>
    `Revisado desde donde la rama se separó de ${params.baseLabel} (${params.baseShort}) hasta ${params.headShort}: ${
      params.commitsCount
    } commit${params.commitsCount === 1 ? '' : 's'}${formatUncommittedEs(params.uncommittedFilesCount)}, ${
      params.filesCount
    } archivo${params.filesCount === 1 ? '' : 's'}, ${formatLinesEs(params.added, params.removed)}`,
  rangeUnpushed: (params) =>
    `Revisado lo que no se ha subido de la rama ${params.branch ?? params.baseLabel}, desde ${params.baseLabel} (${
      params.baseShort
    }) hasta ${params.headShort}: ${params.commitsCount} commit${
      params.commitsCount === 1 ? '' : 's'
    }${formatUncommittedEs(params.uncommittedFilesCount)}, ${params.filesCount} archivo${
      params.filesCount === 1 ? '' : 's'
    }, ${formatLinesEs(params.added, params.removed)}`,
  rangeSinceRun: (params) =>
    `Revisado desde la última revisión (${params.baseShort}) hasta ${params.headShort}: ${params.commitsCount} commit${
      params.commitsCount === 1 ? '' : 's'
    }${formatUncommittedEs(params.uncommittedFilesCount)}, ${params.filesCount} archivo${
      params.filesCount === 1 ? '' : 's'
    }, ${formatLinesEs(params.added, params.removed)}`,
  rangeSinceRef: (params) =>
    `Revisado desde ${params.baseLabel} (${params.baseShort}) hasta ${params.headShort}: ${
      params.commitsCount
    } commit${params.commitsCount === 1 ? '' : 's'}${formatUncommittedEs(params.uncommittedFilesCount)}, ${
      params.filesCount
    } archivo${params.filesCount === 1 ? '' : 's'}, ${formatLinesEs(params.added, params.removed)}`,
  rulesUsed: (selected, total) => `Se usaron ${selected} de las ${total} reglas del proyecto.`,
  reasonPolicy: 'política del proyecto (aplica siempre)',
  reasonAppliesTo: (pattern, files) => `aplica a ${files.join(', ')} (patrón ${pattern})`,
  reasonKeyword: (keyword, where) =>
    `palabra clave «${keyword}» en ${where === 'changes' ? 'los cambios' : 'la tarea'}`,
  importedSession: (file) => `hallazgos importados de ${file}`,
  repoUnchanged: 'El repositorio quedó sin cambios.',
  discardedByVerifier: (count) =>
    `El verificador descartó ${count} hallazgo${count === 1 ? '' : 's'}.`,
  discardedByValidation: (count) =>
    `La validación descartó ${count} hallazgo${count === 1 ? '' : 's'}.`,
  languageFallbackNote: (lang) =>
    `Los textos fijos usan inglés porque el idioma «${lang}» no tiene traducción.`,
  fileStatusNew: 'nuevo',
  fileStatusModified: 'modificado',
  fileStatusDeleted: 'borrado',
  fileStatusRenamed: 'renombrado',
  fileProblems: (problems) => {
    if (problems.length === 0) return 'sin problemas';
    if (problems.length === 1) return `problema ${problems[0]}`;
    return `problemas ${problems.slice(0, -1).join(', ')} y ${problems[problems.length - 1]}`;
  },
  fileOutOfScope: 'fuera de la tarea',
  fileNoProblems: 'sin problemas',
};

const TEXTS_EN: ReportTexts = {
  stampApproved: 'Approved',
  stampNotApproved: 'Not approved',
  verdictAria: (approved) => `Verdict: ${approved ? 'approved' : 'not approved'}`,
  headerMeta: (taskId, branch, date) =>
    taskId
      ? `Task ${taskId}${branch ? `, branch ${branch}` : ''}. Reviewed on ${date}.`
      : `${branch ? `Branch ${branch}. ` : ''}Reviewed on ${date}.`,
  titleWithoutTask: (target) => `Review of ${target}`,
  formatDate: ({ day, month, year, hour, minute }) => `${month} ${day}, ${year}, ${hour}:${minute}`,
  largeChangeWarning: 'large change: consider splitting in the future',
  sectionTaskTitle: 'Did it meet the task requirements?',
  criteriaMet: (met, total) =>
    `${met} of ${total} ${total === 1 ? 'criterion' : 'criteria'} met.`,
  criteriaNoTask: 'no task: not evaluated',
  criteriaNone: 'The task has no criteria.',
  statusMet: 'Met',
  statusNotMet: 'Not met',
  statusPartial: 'Partial',
  statusNotEvaluated: 'Not evaluated',
  sectionIssuesTitle: 'What you need to review',
  issuesSub: (count) =>
    `${count} issue${count === 1 ? '' : 's'}. Mark each one when reviewed; checkmarks are saved in this browser.`,
  severityCritical: 'Critical',
  severityCriticalDetail: 'Critical, prevents approval',
  severityMajor: 'Major',
  severityMinor: 'Minor',
  markReviewed: 'Reviewed',
  codeToday: 'Today',
  codeSuggestion: 'Could look like this',
  codeSuggestionDetail: '(suggestion, reviewer does not change code)',
  codeSuggestionDetailShort: '(suggestion)',
  labelRule: 'Rule',
  labelOrigin: 'Origin',
  labelExisting: 'Already exists',
  labelRelated: 'Related',
  labelCertainty: 'Certainty',
  ruleKindPolicy: 'policy, never broken',
  ruleKindRule: 'rule',
  ruleKindBusiness: 'business',
  ruleKindDecision: 'decision',
  ruleKindTemplate: 'template',
  noRuleDefect: 'Functional defect; no rule covers it.',
  suggestedRuleBelowNote: 'A new rule is suggested below.',
  confirmedByVerifier: 'Confirmed by verifier.',
  unverified: 'Unverified.',
  quotedLineExists: 'The quoted line exists and says this.',
  fileExists: 'The file exists.',
  certainty: (verified, wholeFile) =>
    `${verified ? 'Confirmed by verifier.' : 'Unverified.'} ${
      wholeFile ? 'The file exists.' : 'The quoted line exists and says this.'
    }`,
  wholeFileSummary: (lines) => `View whole file (${lines} lines)`,
  fileLineLabel: (file, line) => (line !== undefined ? `${file}, line ${line}` : file),
  wholeFileLabel: (status, lines) => `whole file (${status ? `${status}, ` : ''}${lines} lines)`,
  relatedCriterion: (num, statusText) => `Task criterion ${num}, ${statusText.toLowerCase()}.`,
  relatedFinding: (num, title) => `Issue ${num}: ${title}`,
  sectionImpactTitle: 'What else could break',
  sectionOutOfScopeTitle: 'Changes outside task',
  outOfScopeNote: (file, line, note) =>
    `Modified ${file}${line !== undefined ? ` at line ${line}` : ''} (${note}). Decide whether it stays in this branch or moves to a separate one.`,
  sectionIdeasTitle: 'Ideas for improvement',
  ideasSub: 'Optional. Do not affect verdict.',
  sectionSuggestedRulesTitle: 'Suggested new rule',
  suggestedRuleText: (text, fromNumber) =>
    fromNumber !== undefined ? `"${text}". Derived from issue ${fromNumber}.` : `"${text}".`,
  sectionDetailsTitle: 'Review details',
  editorSelectorLabel: 'Editor:',
  editorOptions: {
    vscode: 'VS Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    jetbrains: 'JetBrains',
    zed: 'Zed',
    none: 'None',
  },
  rangeBranch: (params) =>
    `Reviewed from where the branch split from ${params.baseLabel} (${params.baseShort}) to ${params.headShort}: ${
      params.commitsCount
    } commit${params.commitsCount === 1 ? '' : 's'}${formatUncommittedEn(params.uncommittedFilesCount)}, ${
      params.filesCount
    } file${params.filesCount === 1 ? '' : 's'}, ${formatLinesEn(params.added, params.removed)}`,
  rangeUnpushed: (params) =>
    `Reviewed the unpushed work on branch ${params.branch ?? params.baseLabel}, from ${params.baseLabel} (${
      params.baseShort
    }) to ${params.headShort}: ${params.commitsCount} commit${
      params.commitsCount === 1 ? '' : 's'
    }${formatUncommittedEn(params.uncommittedFilesCount)}, ${params.filesCount} file${
      params.filesCount === 1 ? '' : 's'
    }, ${formatLinesEn(params.added, params.removed)}`,
  rangeSinceRun: (params) =>
    `Reviewed since last run (${params.baseShort}) to ${params.headShort}: ${params.commitsCount} commit${
      params.commitsCount === 1 ? '' : 's'
    }${formatUncommittedEn(params.uncommittedFilesCount)}, ${params.filesCount} file${
      params.filesCount === 1 ? '' : 's'
    }, ${formatLinesEn(params.added, params.removed)}`,
  rangeSinceRef: (params) =>
    `Reviewed since ${params.baseLabel} (${params.baseShort}) to ${params.headShort}: ${
      params.commitsCount
    } commit${params.commitsCount === 1 ? '' : 's'}${formatUncommittedEn(params.uncommittedFilesCount)}, ${
      params.filesCount
    } file${params.filesCount === 1 ? '' : 's'}, ${formatLinesEn(params.added, params.removed)}`,
  rulesUsed: (selected, total) => `Used ${selected} of ${total} project rules.`,
  reasonPolicy: 'project policy (always applies)',
  reasonAppliesTo: (pattern, files) => `applies to ${files.join(', ')} (pattern ${pattern})`,
  reasonKeyword: (keyword, where) =>
    `keyword "${keyword}" in ${where === 'changes' ? 'changes' : 'task'}`,
  importedSession: (file) => `findings imported from ${file}`,
  repoUnchanged: 'The repository remained unchanged.',
  discardedByVerifier: (count) =>
    `The verifier discarded ${count} finding${count === 1 ? '' : 's'}.`,
  discardedByValidation: (count) =>
    `Validation discarded ${count} finding${count === 1 ? '' : 's'}.`,
  languageFallbackNote: (lang) =>
    `Fixed texts use English because language "${lang}" is not supported.`,
  fileStatusNew: 'new',
  fileStatusModified: 'modified',
  fileStatusDeleted: 'deleted',
  fileStatusRenamed: 'renamed',
  fileProblems: (problems) => {
    if (problems.length === 0) return 'no issues';
    if (problems.length === 1) return `issue ${problems[0]}`;
    return `issues ${problems.slice(0, -1).join(', ')} and ${problems[problems.length - 1]}`;
  },
  fileOutOfScope: 'out of scope',
  fileNoProblems: 'no issues',
};

/** Static dictionary containing all report UI texts for supported languages. */
export const TEXTS: Record<'en' | 'es', ReportTexts> = {
  en: TEXTS_EN,
  es: TEXTS_ES,
};
```

## Ejemplos con datos reales

### Caso normal

Resolución de idioma para valores válidos en español e inglés:

```ts
resolveReportLanguage('es-MX');
// → { ui: 'es', fallback: false }

resolveReportLanguage('en-GB');
// → { ui: 'en', fallback: false }
```

### Caso límite

Resolución de idioma para un valor no soportado que activa el mecanismo de respaldo en inglés:

```ts
resolveReportLanguage('fr');
// → { ui: 'en', fallback: true }

TEXTS.en.languageFallbackNote('fr');
// → 'Fixed texts use English because language "fr" is not supported.'
```

### Sin la línea clave

Sin la condición `normalized.startsWith('es-')`, variantes regionales habituales de configuración como `es-CO` o `es-AR` no se reconocerían como español y activarían indebidamente el respaldo en inglés, generando informes en inglés para proyectos configurados en español.

## Resumen de comportamientos

- **Código de idioma español (`es`, `es-MX`, mayúsculas o con espacios):** devuelve `{ ui: 'es', fallback: false }`.
- **Código de idioma inglés (`en`, `en-US`, mayúsculas o con espacios):** devuelve `{ ui: 'en', fallback: false }`.
- **Cualquier otro código o valor vacío:** devuelve `{ ui: 'en', fallback: true }`.
- **Catálogo de textos:** garantiza paridad completa de claves entre inglés y español sin cadenas vacías.
- **Formateadores dinámicos:** devuelven frases completas adaptadas a singular y plural para commits, archivos sin confirmar y conteo de problemas.
- **Concordancia de criterios cumplidos (`criteriaMet`):** el plural se rige por el total (`criterio cumplido` si el total es 1, `criterios cumplidos` si es distinto de 1; p. ej., `1 de 3 criterios cumplidos.`).
- **Ficha sin criterios (`criteriaNone`):** provee una frase específica («La tarea no tiene criterios.») distinta de la ausencia de ficha (`criteriaNoTask`).
- **Plurales de líneas agregadas y quitadas:** distingue singular y plural en las cuatro funciones de rango («1 línea agregada y 1 quitada.» frente a «7 líneas agregadas y 2 quitadas.»).
- **Redacción de rangos:** `rangeUnpushed` evita dos puntos repetidos y `rangeBranch` en inglés emplea «where the branch split from».
- **Lista de problemas por archivo (`fileProblems`):** devuelve «sin problemas» si la lista está vacía, «problema X» si tiene un elemento y «problemas X, Y y Z» si tiene varios.

## Dónde se usa

### Usa

No importa dependencias externas ni otros módulos locales (solo define tipos e implementaciones de cadenas y formateadores).

### Lo usan

- [`src/report/model.ts`](230-report-model.md), líneas 13-19, para resolver el idioma del informe y dar formato a textos fijos y fechas. Hoy ningún comando de la interfaz de terminal lo usa directamente.

## Pruebas

- `src/report/i18n.test.ts`: resolución de variantes de español e inglés sin respaldo.
- `src/report/i18n.test.ts`: activación de respaldo a inglés con bandera activa para idiomas desconocidos.
- `src/report/i18n.test.ts`: paridad de claves y ausencia de cadenas vacías entre los catálogos `en` y `es`.
- `src/report/i18n.test.ts`: comprobación de retorno no vacío en todas las funciones formateadoras.
Parte 3 · Página 29 de 34 · Anterior: [Modelo del informe](230-report-model.md) · Siguiente: [Desarrollo](../4-development/10-development.md) · [Índice](../README.md)
