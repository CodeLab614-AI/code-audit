import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG_DIR } from '../config/paths.js';
import { findRepoRoot } from '../git/git.js';
import { projectTemplates } from './templates.js';

/** Reports a language value that cannot be stored safely in config.md. */
export class InvalidLanguageError extends Error {
  /** Creates a diagnostic containing the rejected language value. */
  constructor(language: string) {
    super(`invalid language: ${language}`);
    this.name = 'InvalidLanguageError';
  }
}

/** Creates the project configuration without replacing existing files. */
export async function initProject(
  root: string,
  opts: { language: string },
): Promise<{ created: string[]; skipped: string[]; gitignoreUpdated: boolean }> {
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(opts.language)) {
    throw new InvalidLanguageError(opts.language);
  }
  const repoRoot = await findRepoRoot(root);
  const created: string[] = [];
  const skipped: string[] = [];
  for (const [file, content] of projectTemplates(opts.language)) {
    const relative = `${CONFIG_DIR}/${file}`;
    const absolute = join(repoRoot, relative);
    await mkdir(join(absolute, '..'), { recursive: true });
    try {
      await writeFile(absolute, content, { flag: 'wx' });
      created.push(relative);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      skipped.push(relative);
    }
  }
  const gitignoreUpdated = await updateGitignore(repoRoot);
  return { created, skipped, gitignoreUpdated };
}

/** Ensures both generated runtime folders are ignored without duplicate entries. */
async function updateGitignore(root: string): Promise<boolean> {
  const path = join(root, '.gitignore');
  let content: string;
  let exists = true;
  try { content = await readFile(path, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    exists = false;
    content = '';
  }
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const existing = new Set(content.split(/\r?\n/).map(normalizeGitignoreLine));
  const missing = GITIGNORE_LINES.filter((line) => !existing.has(normalizeGitignoreLine(line)));
  if (missing.length === 0) return false;
  const prefix = content.length > 0 && !content.endsWith('\n') ? newline : '';
  const additions = `${prefix}${missing.join(newline)}${newline}`;
  await writeFile(path, additions, { flag: exists ? 'a' : 'wx' });
  return true;
}

/** Normalizes optional slashes around a generated ignore path. */
function normalizeGitignoreLine(line: string): string {
  return line.trim().replace(/^\/+|\/+$/g, '');
}

/** Paths added to a project's Git ignore file by init. */
export const GITIGNORE_LINES = ['.agents/code-audit/tasks/', '.agents/code-audit/runs/'];
