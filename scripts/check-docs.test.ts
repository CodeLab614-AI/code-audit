import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDocs } from './check-docs.js';

/** Creates a minimal valid bilingual docs project in a temporary directory. */
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'code-audit-docs-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(join(root, 'src/a.ts'), '/** Public entry. */\nexport function a(): void {}\n');
  await writeFile(join(root, 'scripts/a.ts'), '/** Build entry. */\nexport const build = 1;\n');
  await writeFile(join(root, 'README.md'), '# Project\n');
  for (const lang of ['en', 'es']) {
    const docs = join(root, 'docs', lang);
    await mkdir(join(docs, '3-code'), { recursive: true });
    await mkdir(join(docs, '4-development'), { recursive: true });
    await writeFile(join(docs, 'README.md'), `# Index\n\n1. [A](3-code/010-a.md)\n2. [Build](4-development/17-a.md)\n`);
    const firstNav = lang === 'es'
      ? 'Parte 3 · Página 1 de 2 · Siguiente: [Build](../4-development/17-a.md) · [Índice](../README.md)'
      : 'Part 3 · Page 1 of 2 · Next: [Build](../4-development/17-a.md) · [Index](../README.md)';
    const lastNav = lang === 'es'
      ? 'Parte 4 · Página 2 de 2 · Anterior: [A](../3-code/010-a.md) · (última) · [Índice](../README.md)'
      : 'Part 4 · Page 2 of 2 · Previous: [A](../3-code/010-a.md) · (last) · [Index](../README.md)';
    const card = lang === 'es'
      ? '**Archivo:** `src/a.ts` · 2 líneas · **Estado:** disponible'
      : '**File:** `src/a.ts` · 2 lines · **Status:** available';
    const buildCard = lang === 'es'
      ? '**Archivo:** `scripts/a.ts` · 2 líneas · **Estado:** disponible'
      : '**File:** `scripts/a.ts` · 2 lines · **Status:** available';
    const sections = lang === 'es'
      ? ['Índice de la página', '¿Qué es y para qué sirve?', 'Antes de leer el código', 'Cómo encaja', 'El código completo, comentado', 'Ejemplos con datos reales', 'Resumen de comportamientos', 'Dónde se usa', 'Pruebas']
      : ['Page index', 'What is it and what is it for?', 'Before reading the code', 'How it fits', 'The complete, commented code', 'Examples with real data', 'Behavior summary', 'Where it is used', 'Tests'];
    const headings = sections.map((section) => `## ${section}\n\nSection content.`).join('\n\n');
    await writeFile(join(docs, '3-code/010-a.md'), `${firstNav}\n\n# A\n\n${card}\n\n${headings}\n\n${firstNav}\n`);
    await writeFile(join(docs, '4-development/17-a.md'), `${lastNav}\n\n# Build\n\n${buildCard}\n\n${headings}\n\n${lastNav}\n`);
  }
  return root;
}

/** Removes a temporary fixture directory after each case. */
async function clean(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

describe('checkDocs', () => {
  it('accepts the real repository with no documentation problems', async () => {
    const root = join(import.meta.dir, '..');
    expect(await checkDocs(root)).toEqual([]);
  });

  it('rejects different English and Spanish reading sequences', async () => {
    const root = await fixture();
    try {
      await writeFile(join(root, 'docs/es/README.md'), '# Índice\n');
      expect((await checkDocs(root)).some((problem) => problem.message.includes('sequences must have identical'))).toBe(true);
    } finally { await clean(root); }
  });

  it('does not count the start-here link as another index page', async () => {
    const root = await fixture();
    try {
      for (const [lang, label] of [['en', 'Start here: [page 1]'], ['es', 'Empieza aquí: [página 1]']]) {
        const index = join(root, 'docs', lang, 'README.md');
        const text = await readFile(index, 'utf8');
        await writeFile(index, text.replace('# Index\n\n', `# Index\n\n${label}(3-code/010-a.md).\n\n`));
      }
      expect(await checkDocs(root)).toEqual([]);
    } finally { await clean(root); }
  });

  it('rejects missing linked pages and orphan Markdown pages', async () => {
    const root = await fixture();
    try {
      await writeFile(join(root, 'docs/en/README.md'), '# Index\n\n1. [Missing](3-code/020-missing.md)\n');
      await writeFile(join(root, 'docs/en/3-code/030-orphan.md'), '# Orphan\n');
      const problems = await checkDocs(root);
      expect(problems.some((problem) => problem.message.includes('linked page is missing'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('orphan page'))).toBe(true);
    } finally { await clean(root); }
  });

  it('rejects duplicate numbers and decreasing page numbers within a folder', async () => {
    const root = await fixture();
    try {
      await writeFile(join(root, 'docs/en/README.md'), '# Index\n\n1. [A](3-code/020-a.md)\n2. [B](3-code/010-b.md)\n');
      await writeFile(join(root, 'docs/en/3-code/020-a.md'), '# A\n');
      await writeFile(join(root, 'docs/en/3-code/010-b.md'), '# B\n');
      const problems = await checkDocs(root);
      expect(problems.some((problem) => problem.message.includes('page numbers must increase'))).toBe(true);
      await writeFile(join(root, 'docs/en/3-code/020-b.md'), '# B\n');
      await writeFile(join(root, 'docs/en/README.md'), '# Index\n\n1. [A](3-code/020-a.md)\n2. [B](3-code/020-b.md)\n');
      expect((await checkDocs(root)).some((problem) => problem.message.includes('duplicate page number'))).toBe(true);
    } finally { await clean(root); }
  });

  it('rejects incorrect page counts and navigation neighbors', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      await writeFile(page, 'Part 3 · Page 2 of 9 · (last) · [Index](../README.md)\n');
      expect((await checkDocs(root)).some((problem) => problem.message.includes('navigation line must show page'))).toBe(true);
    } finally { await clean(root); }
  });

  it('requires a page title immediately after its navigation bar', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      const text = (await readFile(page, 'utf8')).replace('\n\n# A\n', '\n\n## A\n');
      await writeFile(page, text);
      expect((await checkDocs(root)).some((problem) => problem.message.includes('page title must follow the navigation bar'))).toBe(true);
    } finally { await clean(root); }
  });

  it('requires previous and next navigation labels to match destination titles', async () => {
    const root = await fixture();
    try {
      const first = join(root, 'docs/en/3-code/010-a.md');
      const last = join(root, 'docs/en/4-development/17-a.md');
      await writeFile(first, (await readFile(first, 'utf8')).replace('[Build]', '[Wrong build title]'));
      await writeFile(last, (await readFile(last, 'utf8')).replace('[A]', '[Wrong page title]'));
      const problems = await checkDocs(root);
      expect(problems.some((problem) => problem.message.includes('next link label must match destination title'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('previous link label must match destination title'))).toBe(true);
    } finally { await clean(root); }
  });

  it('rejects broken relative links in docs and the root README', async () => {
    const root = await fixture();
    try {
      await writeFile(join(root, 'README.md'), '[Missing](missing.md)\n');
      await writeFile(join(root, 'docs/en/3-code/010-a.md'), '# A\n\n[Missing](missing.md)\n');
      const problems = await checkDocs(root);
      expect(problems.filter((problem) => problem.message.includes('relative link target does not exist')).length).toBeGreaterThanOrEqual(2);
    } finally { await clean(root); }
  });

  it('ignores Markdown links shown inside fenced examples', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      const text = (await readFile(page, 'utf8')).replace('## Tests', '```md\n[Missing](missing.md)\n```\n\n## Tests');
      await writeFile(page, text);
      expect((await checkDocs(root)).some((problem) => problem.message.includes('relative link target does not exist'))).toBe(false);
    } finally { await clean(root); }
  });

  it('rejects a missing source page and an incorrect available line count', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      const content = await readFile(page, 'utf8');
      await writeFile(page, content.replace('2 lines', '8 lines'));
      const problems = await checkDocs(root);
      expect(problems.some((problem) => problem.message.includes('line count does not match'))).toBe(true);
      expect(problems.some((problem) => problem.file === 'docs/es/3-code' && problem.message.includes('must appear in exactly one'))).toBe(false);
    } finally { await clean(root); }
  });

  it('rejects documentation cards with an unsupported status', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      const text = (await readFile(page, 'utf8')).replace('Status:** available', 'Status:** planned');
      await writeFile(page, text);
      expect((await checkDocs(root)).some((problem) => problem.message.includes('code page must declare its file, line count, and available status'))).toBe(true);
    } finally { await clean(root); }
  });

  it('rejects source files declared more than once or missing from disk', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      let content = await readFile(page, 'utf8');
      content = content.replace('`src/a.ts` · 2 lines', '`src/a.ts`, `src/a.ts` · 4 lines');
      await writeFile(page, content);
      const duplicates = await checkDocs(root);
      expect(duplicates.some((problem) => problem.message.includes('must appear in exactly one') && problem.message.includes('found 2'))).toBe(true);
      content = content.replace('`src/a.ts`, `src/a.ts` · 4 lines', '`src/missing.ts` · 2 lines');
      await writeFile(page, content);
      expect((await checkDocs(root)).some((problem) => problem.message.includes('available source file is missing'))).toBe(true);
    } finally { await clean(root); }
  });

  it('rejects undocumented declarations and named functions using the TypeScript AST', async () => {
    const root = await fixture();
    try {
      await writeFile(join(root, 'src/a.ts'), 'export function a(): void {}\nfunction localFunction(): void {}\nconst localArrow = (): void => {};\nexport const value = 1;\nexport class Item {}\nexport interface Shape {}\nexport type Name = string;\n');
      const problems = await checkDocs(root);
      expect(problems.some((problem) => problem.message.includes('function a is missing JSDoc'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('function localFunction is missing JSDoc'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('function localArrow is missing JSDoc'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('constant value is missing JSDoc'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('class Item is missing JSDoc'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('interface Shape is missing JSDoc'))).toBe(true);
      expect(problems.some((problem) => problem.message.includes('type Name is missing JSDoc'))).toBe(true);
    } finally { await clean(root); }
  });

  it('rejects missing or out-of-order code page sections', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      let text = await readFile(page, 'utf8');
      text = text.replace('## Tests', '## Extra');
      await writeFile(page, text);
      expect((await checkDocs(root)).some((problem) => problem.message.includes('missing section: ## Tests'))).toBe(true);
      text = text.replace('## Extra', '## Tests').replace(
        '## Page index\n\nSection content.\n\n## What is it and what is it for?\n\nSection content.',
        '## What is it and what is it for?\n\nSection content.\n\n## Page index\n\nSection content.',
      );
      await writeFile(page, text);
      expect((await checkDocs(root)).some((problem) => problem.message.includes('sections are out of order'))).toBe(true);
    } finally { await clean(root); }
  });

  it('checks any development page that contains a file card', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/4-development/17-a.md');
      const text = (await readFile(page, 'utf8')).replace('## Tests', '## Missing');
      await writeFile(page, text);
      expect((await checkDocs(root)).some((problem) => problem.file === 'docs/en/4-development/17-a.md' && problem.message.includes('missing section: ## Tests'))).toBe(true);
    } finally { await clean(root); }
  });

  it('rejects headings with no content before the next heading or page end', async () => {
    const root = await fixture();
    try {
      const page = join(root, 'docs/en/3-code/010-a.md');
      const text = (await readFile(page, 'utf8'))
        .replace('## Tests\n\nSection content.', '## Empty before next heading\n\n## Tests\n\nSection content.\n\n## Empty at page end');
      await writeFile(page, text);
      const problems = await checkDocs(root);
      expect(problems.some((problem) => problem.file === 'docs/en/3-code/010-a.md'
        && problem.message.includes('heading has no content: ## Empty before next heading'))).toBe(true);
      expect(problems.some((problem) => problem.file === 'docs/en/3-code/010-a.md'
        && problem.message.includes('heading has no content: ## Empty at page end'))).toBe(true);
    } finally { await clean(root); }
  });

  it('finds the repository root from its own file when run outside the repository', () => {
    const root = join(import.meta.dir, '..');
    const result = spawnSync('bun', [join(root, 'scripts/check-docs.ts')], { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Documentation check passed: 0 problems.');
  });
});
