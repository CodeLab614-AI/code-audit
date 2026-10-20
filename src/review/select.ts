import { createMatcher } from '../config/match.js';
import type { Task } from '../config/task.js';
import type { Rule, RuleKind } from '../config/types.js';
import type { ChangedLines } from './changes.js';
import type { ChangedFile } from './types.js';

/** Describes why a rule was selected for the review. */
export type SelectionReason =
  | { type: 'policy' }
  | { type: 'applies_to'; pattern: string; files: string[] }
  | { type: 'keyword'; keyword: string; where: 'changes' | 'task' };

/** Represents a selected rule and all reasons why it matched. */
export interface SelectedRule {
  rule: Rule;
  reasons: SelectionReason[];
}

const KIND_ORDER: Record<RuleKind, number> = {
  policy: 0,
  rule: 1,
  business: 2,
  decision: 3,
  template: 4,
};

/** Compares strings by Unicode code units for deterministic ordering. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Escapes regular expression special characters in a literal string. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Creates a Unicode word-bounded regular expression for a normalized keyword term. */
function createKeywordRegex(keyword: string): RegExp | undefined {
  const normalized = normalizeForKeywords(keyword).trim();
  if (normalized === '') {
    return undefined;
  }
  const words = normalized.split(/\s+/);
  const pattern = words.map(escapeRegex).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'u');
}

/** Normalizes text for keyword matching by converting to lowercase and stripping combining marks. */
export function normalizeForKeywords(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Evaluates project rules against changed files, changed lines, and task definitions. */
export function selectRules(
  rules: Rule[],
  files: ChangedFile[],
  lines: ChangedLines[],
  task?: Task,
): { selected: SelectedRule[]; total: number } {
  const normalizedChanges: string[] = [];
  for (const fileLines of lines) {
    for (const added of fileLines.added) {
      normalizedChanges.push(normalizeForKeywords(added.text));
    }
    for (const removed of fileLines.removed) {
      normalizedChanges.push(normalizeForKeywords(removed));
    }
  }

  const normalizedTask: string[] = [];
  if (task) {
    normalizedTask.push(normalizeForKeywords(task.objective));
    for (const criterion of task.criteria) {
      normalizedTask.push(normalizeForKeywords(criterion));
    }
  }

  const selected: SelectedRule[] = [];

  for (const rule of rules) {
    if (rule.kind === 'policy') {
      selected.push({
        rule,
        reasons: [{ type: 'policy' }],
      });
      continue;
    }

    const reasons: SelectionReason[] = [];

    const seenPatterns = new Set<string>();
    for (const pattern of rule.appliesTo) {
      if (seenPatterns.has(pattern)) {
        continue;
      }
      seenPatterns.add(pattern);

      const matcher = createMatcher([pattern]);
      const matchedFiles: string[] = [];

      for (const file of files) {
        const matchesPath = matcher(file.path) !== undefined;
        const matchesOldPath = file.oldPath ? matcher(file.oldPath) !== undefined : false;
        if (matchesPath || matchesOldPath) {
          if (!matchedFiles.includes(file.path)) {
            matchedFiles.push(file.path);
            if (matchedFiles.length === 5) {
              break;
            }
          }
        }
      }

      if (matchedFiles.length > 0) {
        reasons.push({
          type: 'applies_to',
          pattern,
          files: matchedFiles,
        });
      }
    }

    const seenKeywords = new Set<string>();
    for (const keyword of rule.keywords) {
      const norm = normalizeForKeywords(keyword).trim();
      if (norm === '' || seenKeywords.has(norm)) {
        continue;
      }
      seenKeywords.add(norm);

      const regex = createKeywordRegex(keyword);
      if (!regex) {
        continue;
      }

      if (normalizedChanges.some((line) => regex.test(line))) {
        reasons.push({
          type: 'keyword',
          keyword,
          where: 'changes',
        });
      }

      if (normalizedTask.some((text) => regex.test(text))) {
        reasons.push({
          type: 'keyword',
          keyword,
          where: 'task',
        });
      }
    }

    if (reasons.length > 0) {
      selected.push({
        rule,
        reasons,
      });
    }
  }

  selected.sort((a, b) => {
    const kindDiff = KIND_ORDER[a.rule.kind] - KIND_ORDER[b.rule.kind];
    if (kindDiff !== 0) {
      return kindDiff;
    }
    return compareText(a.rule.id, b.rule.id);
  });

  return {
    selected,
    total: rules.length,
  };
}
