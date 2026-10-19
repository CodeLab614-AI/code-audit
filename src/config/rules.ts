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
