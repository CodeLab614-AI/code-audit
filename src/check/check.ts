import picomatch from 'picomatch';
import { CONFIG_DIR } from '../config/paths.js';
import { loadConfig } from '../config/config.js';
import { loadRules } from '../config/rules.js';
import type { Problem } from '../config/types.js';
import { runGit } from '../git/git.js';

/** Sets the maximum policy count before check reports a warning. */
export const POLICY_WARNING_THRESHOLD = 15;

/** Validates project configuration, rules, and their file patterns. */
export async function checkProject(root: string): Promise<{ problems: Problem[]; ruleCount: number; policyCount: number }> {
  const [{ problems: configProblems }, { rules, problems: ruleProblems }, fileOutput] = await Promise.all([
    loadConfig(root),
    loadRules(root),
    runGit(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']),
  ]);
  const files = fileOutput.split('\0').filter(Boolean);
  const problems = [...configProblems, ...ruleProblems];
  const rulesById = new Map<string, { file: string; id: string }>();

  for (const rule of rules) {
    const normalizedId = rule.id.toLocaleLowerCase('en-US');
    const previous = rulesById.get(normalizedId);
    if (previous) {
      const duplicateMessage = rule.id === previous.id
        ? `duplicate rule id "${rule.id}" also appears in ${previous.file}`
        : `duplicate rule id "${rule.id}" also appears in ${previous.file} as "${previous.id}"`;
      problems.push({
        level: 'error',
        file: rule.file,
        message: duplicateMessage,
      });
    } else rulesById.set(normalizedId, { file: rule.file, id: rule.id });

    if (rule.kind === 'policy') continue;
    for (const pattern of rule.appliesTo) {
      let matches = false;
      try {
        const match = picomatch(pattern, { dot: true });
        matches = files.some((file) => match(file));
      } catch {
        matches = false;
      }
      if (!matches) {
        problems.push({ level: 'warning', file: rule.file, message: `applies_to pattern matches no file: ${pattern}` });
      }
    }
  }

  const policyCount = rules.filter((rule) => rule.kind === 'policy').length;
  if (policyCount > POLICY_WARNING_THRESHOLD) {
    problems.push({
      level: 'warning',
      file: `${CONFIG_DIR}/policies`,
      message: `policies/ has ${policyCount} rules; they are read on every review, keep them few`,
    });
  }

  problems.sort((a, b) => compareProblems(a, b));
  return { problems, ruleCount: rules.length, policyCount };
}

/** Orders errors before warnings, then sorts each group by file and message. */
function compareProblems(a: Problem, b: Problem): number {
  const levelOrder = (a.level === 'error' ? 0 : 1) - (b.level === 'error' ? 0 : 1);
  if (levelOrder !== 0) return levelOrder;
  return compareText(a.file, b.file) || compareText(a.message, b.message);
}

/** Compares strings by Unicode code units for machine-independent ordering. */
function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
