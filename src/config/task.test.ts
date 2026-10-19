import { describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTask } from './task.js';

async function project(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'code-audit-task-'));
}

async function saveTask(root: string, file: string, content: string): Promise<void> {
  const path = join(root, file);
  await Bun.write(path, content);
}

const template = `---
source: https://empresa.atlassian.net/browse/PAY-123
---
## Objetivo
Qué se quiere lograr y por qué.

## Criterios de aceptación
1. Botón «Pagar» visible en el checkout.
2. Total con IVA calculado en centavos.
3. Mensaje si el cobro falla, con opción de reintentar.

## Fuera de alcance

## Áreas que se espera tocar (opcional)

## Notas y decisiones (Figma, acuerdos)
`;

describe('loadTask', () => {
  it('loads the Spanish template and omits its empty optional sections', async () => {
    const root = await project();
    try {
      await saveTask(root, 'tasks/PAY-123.md', template);
      const result = await loadTask(root, 'tasks/PAY-123.md');
      expect(result).toEqual({
        task: {
          file: 'tasks/PAY-123.md',
          source: 'https://empresa.atlassian.net/browse/PAY-123',
          objective: 'Qué se quiere lograr y por qué.',
          criteria: [
            'Botón «Pagar» visible en el checkout.',
            'Total con IVA calculado en centavos.',
            'Mensaje si el cobro falla, con opción de reintentar.',
          ],
        },
        problems: [],
      });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('loads English section headings and normalizes headings with accents and parentheses', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', `## OBJECTIVE\nGoal.\n## Acceptance criteria\n1. One.\n## Out of scope\nOutside.\n## Expected areas (optional)\nSource files.\n## Notes (Figma, agreements)\nDecision.`);
      expect((await loadTask(root, 'task.md')).task).toEqual({
        file: 'task.md', objective: 'Goal.', criteria: ['One.'], outOfScope: 'Outside.',
        expectedAreas: 'Source files.', notes: 'Decision.',
      });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('requires a non-empty objective', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Criterios de aceptación\n1. Uno.');
      const result = await loadTask(root, 'task.md');
      expect(result.task).toBeUndefined();
      expect(result.problems).toContainEqual({ level: 'error', file: 'task.md', message: 'objective is required' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('requires numbered acceptance criteria', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Objetivo\nMeta.\n## Criterios de aceptación\n- Sin numerar.');
      const result = await loadTask(root, 'task.md');
      expect(result.task).toBeUndefined();
      expect(result.problems).toContainEqual({ level: 'error', file: 'task.md', message: 'acceptance criteria must be a numbered list' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('joins indented continuation lines to a criterion', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Objetivo\nMeta.\n## Criterios de aceptación\n1. Primera línea\n   continuación.\n\n2) Otra.');
      expect((await loadTask(root, 'task.md')).task?.criteria).toEqual(['Primera línea continuación.', 'Otra.']);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('does not treat headings inside fenced code as sections', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Objetivo\nMeta.\n```md\n## Criterios de aceptación\n```\n## Criterios de aceptación\n1. Válido.');
      expect((await loadTask(root, 'task.md')).task?.criteria).toEqual(['Válido.']);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('warns for unknown sections and ignores their text', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Objetivo\nMeta.\n## Criterios de aceptación\n1. Válido.\n## Otra sección\nIgnorar.');
      const result = await loadTask(root, 'task.md');
      expect(result.task?.criteria).toEqual(['Válido.']);
      expect(result.problems).toEqual([{ level: 'warning', file: 'task.md', message: 'unknown section: Otra sección' }]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('errors for duplicate sections', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Objetivo\nMeta.\n## Objetivo\nOtra meta.\n## Criterios de aceptación\n1. Válido.');
      const result = await loadTask(root, 'task.md');
      expect(result.task).toBeUndefined();
      expect(result.problems).toContainEqual({ level: 'error', file: 'task.md', message: 'duplicate section: Objetivo' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('accepts a task without YAML frontmatter and ignores text before the first section', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', 'Texto introductorio ignorado.\n\n## Objetivo\nMeta.\n## Criterios de aceptación\n1. Válido.');
      expect((await loadTask(root, 'task.md')).task).toMatchObject({ objective: 'Meta.', criteria: ['Válido.'] });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('returns FrontmatterError messages with their line for malformed YAML', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '---\nsource: [broken\n---\n## Objetivo\nMeta.');
      const result = await loadTask(root, 'task.md');
      expect(result.task).toBeUndefined();
      expect(result.problems[0]).toMatchObject({ level: 'error', file: 'task.md', message: expect.stringMatching(/^Invalid YAML at line 2:/) });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects a non-text source and warns for unknown YAML fields', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '---\nsource: 17\nother: yes\n---\n## Objetivo\nMeta.\n## Criterios de aceptación\n1. Válido.');
      const result = await loadTask(root, 'task.md');
      expect(result.task).toBeUndefined();
      expect(result.problems).toEqual([
        { level: 'warning', file: 'task.md', message: 'unknown field: other' },
        { level: 'error', file: 'task.md', message: 'source must be a string' },
      ]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('accepts BOM and CRLF with and without frontmatter', async () => {
    const root = await project();
    try {
      await saveTask(root, 'yaml.md', `\uFEFF---\r\nsource: ticket\r\n---\r\n## Objetivo\r\nMeta.\r\n## Criterios de aceptación\r\n1. Uno.`);
      await saveTask(root, 'plain.md', `\uFEFF## Objetivo\r\nMeta.\r\n## Criterios de aceptación\r\n1. Uno.`);
      expect((await loadTask(root, 'yaml.md')).task?.source).toBe('ticket');
      expect((await loadTask(root, 'plain.md')).task?.criteria).toEqual(['Uno.']);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('resolves relative paths and reports absolute paths outside the root with forward slashes', async () => {
    const root = await project();
    const outside = await project();
    try {
      await saveTask(root, 'nested/task.md', '## Objetivo\nMeta.\n## Criterios de aceptación\n1. Uno.');
      await saveTask(outside, 'outside.md', '## Objetivo\nMeta.\n## Criterios de aceptación\n1. Uno.');
      expect((await loadTask(root, join('nested', 'task.md'))).task?.file).toBe('nested/task.md');
      const outsidePath = join(outside, 'outside.md');
      expect((await loadTask(root, outsidePath)).task?.file).toBe(outsidePath.split('\\').join('/'));
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });



  it('recognizes the Spanish Notes heading', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Objetivo\nMeta.\n## Criterios de aceptación\n1. Uno.\n## Notas\nDecisión local.');
      const result = await loadTask(root, 'task.md');
      expect(result.task?.notes).toBe('Decisión local.');
      expect(result.problems).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('recognizes a colon at the end of a known heading', async () => {
    const root = await project();
    try {
      await saveTask(root, 'task.md', '## Objetivo:\nMeta.\n## Criterios de aceptación\n1. Uno.');
      const result = await loadTask(root, 'task.md');
      expect(result.task?.objective).toBe('Meta.');
      expect(result.problems).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('includes the received path when the task file does not exist', async () => {
    const root = await project();
    try {
      const receivedPath = 'missing/task.md';
      const result = await loadTask(root, receivedPath);
      expect(result.task).toBeUndefined();
      expect(result.problems[0]?.message).toContain(receivedPath);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
