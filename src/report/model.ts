import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import type { Task } from '../config/task.js';
import type { Problem, RuleKind, Severity } from '../config/types.js';
import type {
  CriterionResult,
  DiscardedFinding,
  Finding,
  FindingsData,
  OutOfScope,
} from '../findings/schema.js';
import type { ReviewRange } from '../review/types.js';
import type { SelectedRule } from '../review/select.js';
import {
  type RangeDescriptionParams,
  type ReportDateParts,
  type ReportTexts,
  resolveReportLanguage,
  TEXTS,
} from './i18n.js';

/** Final code review evaluation verdict. */
export type Verdict = 'approved' | 'not_approved';

/** One line of code with display line number and highlighting flag. */
export interface CodeLine {
  number: number;
  text: string;
  marked: boolean;
}

/** Normalized finding representation prepared for report templates. */
export interface ReportFinding {
  number: number;
  id: string;
  title: string;
  severity: Severity;
  file: string;
  line?: number;
  endLine?: number;
  wholeFile: boolean;
  impact: string;
  today?: CodeLine[];
  wholeFileView?: {
    lines: CodeLine[];
    total: number;
    truncated: boolean;
  };
  suggestion?: CodeLine[];
  rule?: {
    id: string;
    title: string;
    kind: RuleKind;
    severity: Severity;
    file: string;
  };
  suggestedRuleBelow: boolean;
  related: {
    findings: { number: number; title: string }[];
    criteria: { number: number; status: 'met' | 'partial' | 'not_met' | 'not_evaluated' }[];
    note?: string;
  };
  existing?: {
    file: string;
    line?: number;
    note: string;
  };
  verified: boolean;
  certainty: string;
}

/** Suggested rule with optional reference finding number. */
export interface ReportSuggestedRule {
  text: string;
  fromNumber?: number;
}

/** Detailed description of a selected rule in the report details section. */
export interface ReportRuleDetails {
  id: string;
  title: string;
  kind: RuleKind;
  severity: Severity;
  file: string;
  reasons: string[];
}

/** Formatted range metrics and description. */
export interface ReportRangeDetails {
  mode: 'branch' | 'unpushed' | 'since-run' | 'since-ref';
  baseLabel: string;
  baseShort: string;
  headShort: string;
  commits: number;
  uncommitted: number;
  files: number;
  added: number;
  removed: number;
  text: string;
}

/** Reviewed file entry with diagnostic status and problem references. */
export interface ReportFileDetails {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  problems: number[];
  outOfScope: boolean;
}

/** Supplementary operational details included in the report footer. */
export interface ReportDetails {
  range: ReportRangeDetails;
  commits: { sha: string; subject: string }[];
  rules: {
    selected: number;
    total: number;
    summary: string;
    items: ReportRuleDetails[];
  };
  sessions: string[];
  discardedBySession: DiscardedFinding[];
  discardedByValidation: DiscardedFinding[];
  validationNotes: string[];
  configProblems: Problem[];
  ignoredByConfig: string[];
  languageFallback: string | null;
  files: ReportFileDetails[];
}

/** Complete normalized view model backing HTML and Markdown report generation. */
export interface ReportModel {
  ui: 'en' | 'es';
  texts: ReportTexts;
  root: string;
  runId: string;
  title: string;
  taskId?: string;
  branch: string | null;
  headShort: string;
  date: string;
  verdict: Verdict;
  summary: string;
  large: boolean;
  criteria: {
    evaluated: boolean;
    items: CriterionResult[];
    met: number;
    total: number;
  };
  findings: ReportFinding[];
  impact: string[];
  outOfScope: OutOfScope[];
  ideas: string[];
  suggestedRules: ReportSuggestedRule[];
  details: ReportDetails;
}

/** Input parameters required to assemble the report view model. */
export interface BuildReportModelInput {
  root: string;
  runId: string;
  createdAt: string;
  timeZone?: string;
  language: string;
  range: ReviewRange;
  rules: { selected: SelectedRule[]; total: number };
  task?: Task;
  data: FindingsData;
  discarded: DiscardedFinding[];
  notes: string[];
  configProblems: Problem[];
  sessions: string[];
}

/** Evaluates overall review verdict based on finding severities. */
export function computeVerdict(findings: Array<{ severity: Severity }>): Verdict {
  const hasBlocker = findings.some((f) => f.severity === 'critical' || f.severity === 'major');
  return hasBlocker ? 'not_approved' : 'approved';
}

/** Computes report title from task objective or fallback branch label. */
export function computeTitle(
  task: Task | undefined,
  branch: string | null,
  headShort: string,
  texts: ReportTexts,
): string {
  if (task && task.objective) {
    const collapsed = task.objective.replace(/\s+/g, ' ').trim();
    if (collapsed !== '') {
      const match = collapsed.match(/^(.*?[.!?])(?:\s|$)/);
      let sentence = (match ? match[1]! : collapsed).trim();
      if (sentence.endsWith('.')) {
        sentence = sentence.slice(0, -1).trim();
      }
      if (sentence !== '') {
        const chars = Array.from(sentence);
        if (chars.length > 80) {
          const slice80 = chars.slice(0, 80);
          const lastSpaceIndex = slice80.lastIndexOf(' ');
          if (lastSpaceIndex !== -1) {
            return `${chars.slice(0, lastSpaceIndex).join('')}…`;
          }
          return `${chars.slice(0, 79).join('')}…`;
        }
        return sentence;
      }
    }
  }
  const target = branch ?? headShort;
  return texts.titleWithoutTask(target);
}

/** Formats ISO timestamp into localized display date string. */
export function formatReportDate(
  isoDate: string,
  timeZone: string | undefined,
  ui: 'en' | 'es',
  texts: ReportTexts,
): string {
  const d = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat(ui === 'es' ? 'es' : 'en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  });
  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const dateParts: ReportDateParts = {
    day: map.day ?? '',
    month: map.month ?? '',
    year: map.year ?? '',
    hour: map.hour ?? '',
    minute: map.minute ?? '',
  };
  return texts.formatDate(dateParts);
}

/** Parses raw file content into line strings stripping trailing carriage returns. */
function parseLines(content: string): string[] {
  if (content === '') return [];
  const normalized = content.endsWith('\n') ? content.slice(0, -1) : content;
  if (normalized === '') return [];
  return normalized.split('\n').map((line) => line.replace(/\r$/, ''));
}

/** Builds the full ReportModel data structure from review inputs. */
export async function buildReportModel(input: BuildReportModelInput): Promise<ReportModel> {
  const { ui, fallback } = resolveReportLanguage(input.language);
  const texts = TEXTS[ui];
  const root = isAbsolute(input.root) ? input.root : resolve(input.root);
  const headShort = input.range.headSha.slice(0, 7);
  const baseShort = input.range.baseSha.slice(0, 7);
  const branch = input.range.branch;
  const date = formatReportDate(input.createdAt, input.timeZone, ui, texts);
  const title = computeTitle(input.task, branch, headShort, texts);

  let taskId: string | undefined;
  if (input.task) {
    const filename = input.task.file.split(/[/\\]/).pop() ?? input.task.file;
    taskId = filename.replace(/\.md$/i, '');
  }

  const verdict = computeVerdict(input.data.findings);
  const fileCache = new Map<string, string[]>();

  /** Reads and caches file contents parsed as lines. */
  const getFileLines = async (relativePath: string): Promise<string[]> => {
    const cached = fileCache.get(relativePath);
    if (cached !== undefined) {
      return cached;
    }
    const fullPath = resolve(root, relativePath);
    const content = await readFile(fullPath, 'utf8');
    const lines = parseLines(content);
    fileCache.set(relativePath, lines);
    return lines;
  };

  const findingIdMap = new Map<string, { number: number; title: string }>();
  input.data.findings.forEach((f, idx) => {
    findingIdMap.set(f.id.toLowerCase(), { number: idx + 1, title: f.title });
  });

  const criteriaMap = new Map<number, CriterionResult>();
  input.data.criteria.forEach((c) => criteriaMap.set(c.number, c));

  const reportFindings: ReportFinding[] = [];

  for (let idx = 0; idx < input.data.findings.length; idx++) {
    const finding = input.data.findings[idx]!;
    const findingNum = idx + 1;
    let today: CodeLine[] | undefined;
    let wholeFileView: { lines: CodeLine[]; total: number; truncated: boolean } | undefined;
    let suggestion: CodeLine[] | undefined;

    if (finding.severity !== 'minor') {
      if (finding.wholeFile) {
        const fileLines = await getFileLines(finding.file);
        const total = fileLines.length;
        const truncated = total > 400;
        const count = Math.min(400, total);
        const lines: CodeLine[] = [];
        for (let i = 0; i < count; i++) {
          lines.push({
            number: i + 1,
            text: fileLines[i] ?? '',
            marked: false,
          });
        }
        wholeFileView = { lines, total, truncated };
      } else {
        const fileLines = await getFileLines(finding.file);
        const line = finding.line ?? 1;
        const endLine = finding.endLine ?? line;
        const start = Math.max(1, line - 2);
        const end = Math.min(fileLines.length, endLine + 2);
        const lines: CodeLine[] = [];
        for (let n = start; n <= end; n++) {
          lines.push({
            number: n,
            text: fileLines[n - 1] ?? '',
            marked: n >= line && n <= endLine,
          });
        }
        today = lines;

        if (finding.suggestion) {
          const sugLines = parseLines(finding.suggestion.code);
          const sugCodeLines: CodeLine[] = [];
          for (let i = 0; i < sugLines.length; i++) {
            const lineNum = finding.suggestion.startLine + i;
            const sugText = sugLines[i] ?? '';
            const currentText =
              lineNum >= 1 && lineNum <= fileLines.length ? fileLines[lineNum - 1] : undefined;
            const marked = currentText !== sugText;
            sugCodeLines.push({
              number: lineNum,
              text: sugText,
              marked,
            });
          }
          suggestion = sugCodeLines;
        }
      }
    }

    let rule:
      | { id: string; title: string; kind: RuleKind; severity: Severity; file: string }
      | undefined;
    if (finding.ruleId) {
      const targetId = finding.ruleId.toLowerCase();
      const match = input.rules.selected.find((r) => r.rule.id.toLowerCase() === targetId);
      if (match) {
        rule = {
          id: match.rule.id,
          title: match.rule.title,
          kind: match.rule.kind,
          severity: match.rule.severity,
          file: match.rule.file,
        };
      }
    }

    const findingIdLower = finding.id.toLowerCase();
    const suggestedRuleBelow = input.data.suggestedRules.some(
      (sr) => sr.fromFinding !== undefined && sr.fromFinding.toLowerCase() === findingIdLower,
    );

    const relatedFindings = finding.relatedFindings
      .map((id) => findingIdMap.get(id.toLowerCase()))
      .filter((f): f is { number: number; title: string } => f !== undefined);

    const relatedCriteria = finding.relatedCriteria.map((num) => {
      const match = criteriaMap.get(num);
      return {
        number: num,
        status: match ? match.status : ('not_evaluated' as const),
      };
    });

    const certainty = texts.certainty(finding.verified, finding.wholeFile);

    const existing = finding.existing
      ? { file: finding.existing.file, line: finding.existing.line, note: finding.existing.note }
      : undefined;

    reportFindings.push({
      number: findingNum,
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      file: finding.file,
      line: finding.line,
      endLine: finding.endLine,
      wholeFile: finding.wholeFile,
      impact: finding.impact,
      today,
      wholeFileView,
      suggestion,
      rule,
      suggestedRuleBelow,
      related: {
        findings: relatedFindings,
        criteria: relatedCriteria,
        ...(finding.relatedNote ? { note: finding.relatedNote } : {}),
      },
      existing,
      verified: finding.verified,
      certainty,
    });
  }

  const suggestedRules: ReportSuggestedRule[] = input.data.suggestedRules.map((sr) => {
    let fromNumber: number | undefined;
    if (sr.fromFinding) {
      const found = findingIdMap.get(sr.fromFinding.toLowerCase());
      if (found) {
        fromNumber = found.number;
      }
    }
    return {
      text: sr.text,
      ...(fromNumber !== undefined ? { fromNumber } : {}),
    };
  });

  const criteria = input.task
    ? {
        evaluated: true,
        items: input.data.criteria,
        met: input.data.criteria.filter((c) => c.status === 'met').length,
        total: input.task.criteria.length,
      }
    : {
        evaluated: false,
        items: [],
        met: 0,
        total: 0,
      };

  const rangeParams: RangeDescriptionParams = {
    branch,
    baseLabel: input.range.baseLabel,
    baseShort,
    headShort,
    commitsCount: input.range.commits.length,
    uncommittedFilesCount: input.range.files.filter((f) => f.uncommitted).length,
    filesCount: input.range.files.length,
    added: input.range.added,
    removed: input.range.removed,
  };

  let rangeText: string;
  switch (input.range.mode) {
    case 'branch':
      rangeText = texts.rangeBranch(rangeParams);
      break;
    case 'unpushed':
      rangeText = texts.rangeUnpushed(rangeParams);
      break;
    case 'since-run':
      rangeText = texts.rangeSinceRun(rangeParams);
      break;
    case 'since-ref':
      rangeText = texts.rangeSinceRef(rangeParams);
      break;
  }

  const commits = input.range.commits.map((c) => ({
    sha: c.sha.slice(0, 7),
    subject: c.subject,
  }));

  const ruleItems: ReportRuleDetails[] = input.rules.selected.map((sr) => {
    const reasons = sr.reasons.map((r) => {
      switch (r.type) {
        case 'policy':
          return texts.reasonPolicy;
        case 'applies_to':
          return texts.reasonAppliesTo(r.pattern, r.files);
        case 'keyword':
          return texts.reasonKeyword(r.keyword, r.where);
      }
    });
    return {
      id: sr.rule.id,
      title: sr.rule.title,
      kind: sr.rule.kind,
      severity: sr.rule.severity,
      file: sr.rule.file,
      reasons,
    };
  });

  const fileDetails: ReportFileDetails[] = input.range.files.map((file) => {
    const problems: number[] = [];
    reportFindings.forEach((f) => {
      if (f.file === file.path) {
        problems.push(f.number);
      }
    });
    const inOutOfScope = input.data.outOfScope.some((o) => o.file === file.path);
    const outOfScope = problems.length === 0 && inOutOfScope;
    return {
      path: file.path,
      ...(file.oldPath ? { oldPath: file.oldPath } : {}),
      status: file.status,
      problems,
      outOfScope,
    };
  });

  const details: ReportDetails = {
    range: {
      mode: input.range.mode,
      baseLabel: input.range.baseLabel,
      baseShort,
      headShort,
      commits: input.range.commits.length,
      uncommitted: input.range.files.filter((f) => f.uncommitted).length,
      files: input.range.files.length,
      added: input.range.added,
      removed: input.range.removed,
      text: rangeText,
    },
    commits,
    rules: {
      selected: input.rules.selected.length,
      total: input.rules.total,
      summary: texts.rulesUsed(input.rules.selected.length, input.rules.total),
      items: ruleItems,
    },
    sessions: input.sessions,
    discardedBySession: input.data.discarded,
    discardedByValidation: input.discarded,
    validationNotes: input.notes,
    configProblems: input.configProblems,
    ignoredByConfig: input.range.ignoredByConfig,
    languageFallback: fallback ? input.language : null,
    files: fileDetails,
  };

  return {
    ui,
    texts,
    root,
    runId: input.runId,
    title,
    ...(taskId !== undefined ? { taskId } : {}),
    branch,
    headShort,
    date,
    verdict,
    summary: input.data.summary,
    large: input.range.large,
    criteria,
    findings: reportFindings,
    impact: input.data.impact,
    outOfScope: input.data.outOfScope,
    ideas: input.data.ideas,
    suggestedRules,
    details,
  };
}
