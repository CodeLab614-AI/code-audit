import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../cli.js';
import { loadRules } from '../config/rules.js';
import { loadTask } from '../config/task.js';
import { createRepo, removeRepo, writeRepoFile } from '../test-helpers/repo.js';
import { initProject } from './init.js';

describe('initProject', () => {
  it('creates the Spanish project structure and valid templates', async () => {
    const root = await createRepo('code audit ñ ');
    try {
      const result = await initProject(root, { language: 'es' });
      const config = await readFile(join(root, '.agents/code-audit/config.md'), 'utf8');
      const rules = await loadRules(root);
      const task = await loadTask(root, '.agents/code-audit/task-template.md');

      expect(config).toContain('language: es');
      expect(result.created).toContain('.agents/code-audit/config.md');
      expect(rules.problems).toEqual([]);
      expect(rules.rules).toHaveLength(0);
      expect(task.problems).toEqual([]);
      expect(task.task).toBeDefined();
      expect(task.task?.notes).toBe('Agrega acuerdos o enlaces de diseño relevantes.');
      expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe(
        '.agents/code-audit/tasks/\n.agents/code-audit/runs/\n',
      );
    } finally { await removeRepo(root); }
  });

  it('preserves non-Spanish language values in config and uses English files for fr', async () => {
    const root = await createRepo();
    try {
      await initProject(root, { language: 'fr' });
      expect(await readFile(join(root, '.agents/code-audit/config.md'), 'utf8')).toContain('language: fr');
      expect(await readFile(join(root, '.agents/code-audit/project.md'), 'utf8')).toContain('# Project');
    } finally { await removeRepo(root); }
  });

  it.each(['ES', 'es-MX'])('uses Spanish files for the language value %s', async (language) => {
    const root = await createRepo();
    try {
      await initProject(root, { language });
      expect(await readFile(join(root, '.agents/code-audit/config.md'), 'utf8')).toContain(`language: ${language}`);
      expect(await readFile(join(root, '.agents/code-audit/project.md'), 'utf8')).toContain('# Proyecto');
    } finally { await removeRepo(root); }
  });

  it.each(['es: x', 'es\nx', '-es'])('rejects invalid language %s without creating files', async (language) => {
    const root = await createRepo();
    try {
      await expect(initProject(root, { language })).rejects.toThrow(`invalid language: ${language}`);
      expect(await readdir(root)).not.toContain('.agents');
      expect(await readdir(root)).not.toContain('.gitignore');
    } finally { await removeRepo(root); }
  });

  it('does not replace existing files and reports them as skipped', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, '.agents/code-audit/config.md', 'custom config\n');
      const first = await initProject(root, { language: 'en' });
      const snapshot = await readFile(join(root, '.agents/code-audit/config.md'), 'utf8');
      const filesBeforeSecondRun = await snapshotFiles(join(root, '.agents/code-audit'));
      const gitignoreBeforeSecondRun = await readFile(join(root, '.gitignore'), 'utf8');
      const second = await initProject(root, { language: 'en' });

      expect(snapshot).toBe('custom config\n');
      expect(first.skipped).toContain('.agents/code-audit/config.md');
      expect(second.created).toEqual([]);
      expect(second.skipped.length).toBeGreaterThan(0);
      expect(await readFile(join(root, '.agents/code-audit/config.md'), 'utf8')).toBe(snapshot);
      expect(await snapshotFiles(join(root, '.agents/code-audit'))).toEqual(filesBeforeSecondRun);
      expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe(gitignoreBeforeSecondRun);
    } finally { await removeRepo(root); }
  });

  it('adds missing gitignore entries once while preserving CRLF', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, '.gitignore', 'node_modules\r\n/.agents/code-audit/tasks\r\nkeep-this');
      const result = await initProject(root, { language: 'en' });
      const gitignore = await readFile(join(root, '.gitignore'), 'utf8');

      expect(result.gitignoreUpdated).toBe(true);
      expect(gitignore).toBe(
        'node_modules\r\n/.agents/code-audit/tasks\r\nkeep-this\r\n.agents/code-audit/runs/\r\n',
      );
    } finally { await removeRepo(root); }
  });

  it('adds a line feed after a lone carriage return before new ignore paths', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, '.gitignore', 'a\r');
      await initProject(root, { language: 'en' });
      expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe(
        'a\r\n.agents/code-audit/tasks/\n.agents/code-audit/runs/\n',
      );
    } finally { await removeRepo(root); }
  });

  it.each(['en', 'es'])('loads each %s README rule example without errors or warnings', async (language) => {
    const root = await createRepo();
    try {
      await initProject(root, { language });
      expect(await readFile(join(root, '.agents/code-audit/README.md'), 'utf8')).toContain(
        language === 'es' ? 'Copia task-template.md a tasks/' : 'Copy task-template.md to tasks/',
      );
      const folders = ['policies', 'rules', 'business', 'decisions', 'templates'];
      for (const folder of folders) {
        const readme = await readFile(join(root, '.agents/code-audit', folder, 'README.md'), 'utf8');
        expect(readme).toContain(language === 'es' ? 'title: Ejemplo completo de regla' : 'title: Complete example rule');
        const example = readme.match(/```(?:markdown|md)\n([\s\S]*?)\n```/)?.[1];
        expect(example, `${language} ${folder} README example`).toBeDefined();
        await writeRepoFile(root, `.agents/code-audit/${folder}/example.md`, `${example}\n`);
      }
      const result = await loadRules(root);
      expect(result.problems).toEqual([]);
      expect(result.rules).toHaveLength(5);
      const task = await loadTask(root, '.agents/code-audit/task-template.md');
      expect(task.problems).toEqual([]);
      expect(task.task?.notes).toBeDefined();
    } finally { await removeRepo(root); }
  });

  it('does not duplicate normalized gitignore entries', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, '.gitignore', '.agents/code-audit/tasks\n/.agents/code-audit/runs/\n');
      const result = await initProject(root, { language: 'en' });
      expect(result.gitignoreUpdated).toBe(false);
      expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe(
        '.agents/code-audit/tasks\n/.agents/code-audit/runs/\n',
      );
    } finally { await removeRepo(root); }
  });
});

/** Captures relative file contents for a generated configuration tree. */
async function snapshotFiles(folder: string, prefix = ''): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) Object.assign(files, await snapshotFiles(path, `${prefix}${entry.name}/`));
    else files[`${prefix}${entry.name}`] = await readFile(path, 'utf8');
  }
  return files;
}

describe('init CLI', () => {
  it('prints the init result as JSON and defaults to English', async () => {
    const root = await createRepo();
    try {
      const stdout: string[] = [];
      const code = await main(['init', '--json', '--root', root], {
        stdout: (value) => stdout.push(value), stderr: () => {},
      });
      expect(code).toBe(0);
      expect(JSON.parse(stdout.join('')).created).toContain('.agents/code-audit/config.md');
      expect(await readFile(join(root, '.agents/code-audit/config.md'), 'utf8')).toContain('language: en');
    } finally { await removeRepo(root); }
  });

  it('uses the selected language for generated CLI files', async () => {
    const root = await createRepo();
    try {
      const code = await main(['init', '--language', 'es', '--root', root], { stdout: () => {}, stderr: () => {} });
      expect(code).toBe(0);
      expect(await readFile(join(root, '.agents/code-audit/config.md'), 'utf8')).toContain('language: es');
    } finally { await removeRepo(root); }
  });

  it.each(['es: x', 'es\nx', '-es'])('returns usage error for invalid CLI language %s before writing', async (language) => {
    const root = await createRepo();
    try {
      const stderr: string[] = [];
      const code = await main(['init', '--language', language, '--root', root], {
        stdout: () => {}, stderr: (value) => stderr.push(value),
      });
      expect(code).toBe(1);
      expect(stderr.join('')).toBe(`invalid language: ${language}\n`);
      expect(await readdir(root)).not.toContain('.agents');
      expect(await readdir(root)).not.toContain('.gitignore');
    } finally { await removeRepo(root); }
  });

  it('returns exit code 3 outside a repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'code-audit-outside-'));
    try {
      const stderr: string[] = [];
      const code = await main(['init', '--root', root], { stdout: () => {}, stderr: (value) => stderr.push(value) });
      expect(code).toBe(3);
      expect(stderr.join('')).toContain('not a working Git repository');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
