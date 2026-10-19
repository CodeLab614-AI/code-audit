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
  ['notas y decisiones', 'notes'], ['notas', 'notes'], ['notes', 'notes'],
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
