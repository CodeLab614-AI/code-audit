import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG_DIR } from './paths.js';
import type { Config, Problem } from './types.js';
import { FrontmatterError, parseFrontmatter } from './frontmatter.js';

// Start from the documented defaults so omitted keys stay predictable.
const DEFAULT_CONFIG: Config = {
  structureVersion: 1,
  language: 'en',
  ignore: [],
  maxChangedLines: 1000,
};

const CONFIG_FIELDS = new Set(['structure_version', 'language', 'base_branch', 'ignore', 'max_changed_lines']);

/** Loads and validates the project's config.md file. */
export async function loadConfig(root: string): Promise<{ config: Config; problems: Problem[] }> {
  // Keep reported paths relative while resolving reads from the supplied root.
  const file = `${CONFIG_DIR}/config.md`;
  const path = join(root, CONFIG_DIR, 'config.md');
  let text: string;
  // A missing file is still reported alongside usable default values.
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { config: createDefaultConfig(), problems: [{ level: 'error', file, message: 'config.md not found; run code-audit init first' }] };
  }

  let data: Record<string, unknown>;
  // Reuse the shared YAML reader and preserve its line-aware error.
  try {
    data = parseFrontmatter(text).data;
  } catch (error) {
    const message = error instanceof FrontmatterError ? error.message : String(error);
    return { config: createDefaultConfig(), problems: [{ level: 'error', file, message }] };
  }

  const problems: Problem[] = [];
  /** Adds a config diagnostic with the repository-relative file path. */
  const add = (level: Problem['level'], message: string): void => { problems.push({ level, file, message }); };
  // Unknown keys can reveal spelling mistakes without hiding valid values.
  for (const key of Object.keys(data)) {
    if (key === 'agent') add('error', 'agent must not be set: the agent that launches code-audit is always used');
    else if (!CONFIG_FIELDS.has(key)) add('warning', `unknown field: ${key}`);
  }

  // Validate each known key independently and retain defaults on errors.
  const config = createDefaultConfig();
  if (data.structure_version !== undefined) {
    if (typeof data.structure_version !== 'number' || !Number.isInteger(data.structure_version)) {
      add('error', `structure_version must be an integer; received ${JSON.stringify(data.structure_version)}`);
    } else if (data.structure_version !== 1) {
      add('warning', `structure_version is ${data.structure_version}; this code-audit understands structure version 1`);
    }
  }
  if (data.language !== undefined) {
    if (typeof data.language === 'string' && data.language.length > 0) config.language = data.language;
    else add('error', 'language must be a non-empty string');
  }
  if (data.base_branch !== undefined) {
    if (typeof data.base_branch === 'string') config.baseBranch = data.base_branch;
    else add('error', 'base_branch must be a string');
  }
  if (data.ignore !== undefined) {
    const ignore = normalizeStringList(data.ignore);
    if (ignore) config.ignore = ignore;
    else add('error', 'ignore must be a string or a list of strings');
  }
  if (data.max_changed_lines !== undefined) {
    if (typeof data.max_changed_lines === 'number' && Number.isInteger(data.max_changed_lines) && data.max_changed_lines > 0) {
      config.maxChangedLines = data.max_changed_lines;
    } else add('error', 'max_changed_lines must be a positive integer');
  }
  return { config, problems };
}

/** Returns defaults with a fresh list for each caller. */
function createDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG, ignore: [...DEFAULT_CONFIG.ignore] };
}

/** Converts one string or a list of strings to a fresh list. */
function normalizeStringList(value: unknown): string[] | undefined {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return undefined;
}
