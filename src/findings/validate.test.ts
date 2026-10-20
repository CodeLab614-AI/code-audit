import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Task } from '../config/task.js';
import type { SelectedRule } from '../review/select.js';
import { createRepo, removeRepo, writeRepoFile } from '../test-helpers/repo.js';
import { FINDINGS_SCHEMA_VERSION } from './schema.js';
import { FindingsInvalidError, validateFindings } from './validate.js';

describe('validateFindings', () => {
  let root: string;

  beforeEach(async () => {
    root = await createRepo('code-audit-findings-');
  });

  afterEach(async () => {
    await removeRepo(root);
  });

  const ruleBiz003: SelectedRule = {
    rule: {
      id: 'BIZ-003',
      title: 'Los montos siempre se manejan en centavos',
      severity: 'critical',
      appliesTo: ['src/billing/**'],
      keywords: ['precio', 'total'],
      kind: 'business',
      file: '.agents/code-audit/business/biz-003.md',
      body: 'Body',
    },
    reasons: [{ type: 'applies_to', pattern: 'src/billing/**', files: ['src/billing/total.ts'] }],
  };

  const sampleTask: Task = {
    file: '.agents/code-audit/tasks/PAY-123.md',
    objective: 'Implement checkout payment calculation',
    criteria: [
      'Botón «Pagar» visible en el checkout.',
      'Total con IVA calculado en centavos.',
      'Mensaje si el cobro falla, con opción de reintentar.',
    ],
  };

  it('passes the plan example with zero discarded findings and exact structure', async () => {
    await writeRepoFile(root, 'src/billing/total.ts', [
      '// line 1',
      ...Array.from({ length: 39 }, (_, i) => `// line ${i + 2}`),
      'const total = price * 1.16',
      '// line 42',
    ].join('\n'));
    await writeRepoFile(root, 'src/ui/Button.tsx', 'export function Button() { return <button>Pagar</button>; }\n');
    await writeRepoFile(root, 'src/auth/session.ts', [
      ...Array.from({ length: 87 }, (_, i) => `// line ${i + 1}`),
      'export function getSession() { return null; }',
    ].join('\n'));

    const raw = {
      schema_version: 1,
      summary: 'Tres líneas como máximo: qué hizo el cambio y qué está mal.',
      criteria: [{ number: 2, status: 'not_met', reason: 'Lo calcula con decimales.' }],
      findings: [{
        id: 'F1',
        title: 'El total se calcula con decimales y puede cobrar mal',
        severity: 'critical',
        file: 'src/billing/total.ts',
        line: 41,
        end_line: 41,
        whole_file: false,
        quote: 'const total = price * 1.16',
        impact: 'Qué pasaría en la práctica.',
        suggestion: { start_line: 40, code: 'const priceCents = item.priceCents\n…' },
        rule_id: 'BIZ-003',
        related_findings: [],
        related_criteria: [2],
        related_note: 'Se resuelve también con el problema 3.',
        existing: { file: 'src/ui/Button.tsx', line: 1, note: 'Botón con estado «cargando».' },
        verified: true,
      }],
      out_of_scope: [{ file: 'src/auth/session.ts', line: 88, note: 'Sesiones de usuario.' }],
      ideas: ['El cálculo del IVA está repetido en dos lugares.'],
      suggested_rules: [{ text: 'Todo botón que cobre se desactiva mientras espera.', from_finding: 'F1' }],
      impact: ['El total también lo usan las facturas y los reembolsos.'],
      discarded: [{ id: 'F7', title: '…', reason: 'El verificador encontró la validación en la línea 12.' }],
    };

    const result = await validateFindings(raw, {
      root,
      rules: [ruleBiz003],
      task: sampleTask,
    });

    expect(result.discarded).toEqual([]);
    expect(result.data.schemaVersion).toBe(FINDINGS_SCHEMA_VERSION);
    expect(result.data.summary).toBe('Tres líneas como máximo: qué hizo el cambio y qué está mal.');
    expect(result.data.findings.length).toBe(1);
    expect(result.data.findings[0]).toEqual({
      id: 'F1',
      title: 'El total se calcula con decimales y puede cobrar mal',
      severity: 'critical',
      file: 'src/billing/total.ts',
      line: 41,
      endLine: 41,
      wholeFile: false,
      quote: 'const total = price * 1.16',
      impact: 'Qué pasaría en la práctica.',
      suggestion: { startLine: 40, code: 'const priceCents = item.priceCents\n…' },
      ruleId: 'BIZ-003',
      relatedFindings: [],
      relatedCriteria: [2],
      relatedNote: 'Se resuelve también con el problema 3.',
      existing: { file: 'src/ui/Button.tsx', line: 1, note: 'Botón con estado «cargando».' },
      verified: true,
    });
    expect(result.data.criteria).toEqual([
      { number: 1, text: 'Botón «Pagar» visible en el checkout.', status: 'not_evaluated' },
      { number: 2, text: 'Total con IVA calculado en centavos.', status: 'not_met', reason: 'Lo calcula con decimales.' },
      { number: 3, text: 'Mensaje si el cobro falla, con opción de reintentar.', status: 'not_evaluated' },
    ]);
    expect(result.data.outOfScope).toEqual([
      { file: 'src/auth/session.ts', line: 88, note: 'Sesiones de usuario.' },
    ]);
    expect(result.data.ideas).toEqual(['El cálculo del IVA está repetido en dos lugares.']);
    expect(result.data.suggestedRules).toEqual([
      { text: 'Todo botón que cobre se desactiva mientras espera.', fromFinding: 'F1' },
    ]);
    expect(result.data.impact).toEqual(['El total también lo usan las facturas y los reembolsos.']);
    expect(result.data.discarded).toEqual([
      { id: 'F7', title: '…', reason: 'El verificador encontró la validación en la línea 12.' },
    ]);
  });

  it('rejects the entire file on invalid JSON, wrong schema_version, non-object, invalid findings, or invalid summary', async () => {
    await expect(validateFindings('{ invalid json', { root, rules: [] }))
      .rejects.toThrow(FindingsInvalidError);

    await expect(validateFindings(null, { root, rules: [] }))
      .rejects.toThrow(FindingsInvalidError);

    await expect(validateFindings('not json at all', { root, rules: [] }))
      .rejects.toThrow(FindingsInvalidError);

    await expect(validateFindings({ schema_version: 2, summary: 's', findings: [] }, { root, rules: [] }))
      .rejects.toThrow(FindingsInvalidError);

    await expect(validateFindings({ schema_version: 1, summary: 123, findings: [] }, { root, rules: [] }))
      .rejects.toThrow(FindingsInvalidError);

    await expect(validateFindings({ schema_version: 1, summary: 's', findings: 'not array' }, { root, rules: [] }))
      .rejects.toThrow(FindingsInvalidError);
  });

  it('discards a finding when the quote differs by even one character', async () => {
    await writeRepoFile(root, 'src/billing/total.ts', 'const total = price * 1.16;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [{
        id: 'F1',
        title: 'Error in total calculation',
        severity: 'critical',
        file: 'src/billing/total.ts',
        line: 1,
        end_line: 1,
        quote: 'const total = price * 1.15;',
        impact: 'Calculates wrong',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.data.findings).toEqual([]);
    expect(result.discarded).toEqual([{
      id: 'F1',
      title: 'Error in total calculation',
      reason: 'quote not found in src/billing/total.ts at lines 1-1',
    }]);
  });

  it('matches quotes despite CRLF endings and multiple tabs/spaces', async () => {
    await writeRepoFile(root, 'src/billing/total.ts', '\tconst\t\ttotal  =   price * 1.16;\r\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [{
        id: 'F1',
        title: 'Total calculation',
        severity: 'critical',
        file: 'src/billing/total.ts',
        line: 1,
        end_line: 1,
        quote: 'const total = price * 1.16;',
        impact: 'Calculates wrong',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([]);
    expect(result.data.findings.length).toBe(1);
  });

  it('discards findings outside file lines, with relative traversal, or absolute path', async () => {
    await writeRepoFile(root, 'src/billing/total.ts', Array.from({ length: 10 }, (_, i) => `// line ${i + 1}`).join('\n') + '\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [
        {
          id: 'F1',
          title: 'Out of lines',
          severity: 'major',
          file: 'src/billing/total.ts',
          line: 999,
          end_line: 999,
          quote: '// line 999',
          impact: 'Broken',
        },
        {
          id: 'F2',
          title: 'Parent path',
          severity: 'major',
          file: '../x.ts',
          line: 1,
          quote: 'anything',
          impact: 'Broken',
        },
        {
          id: 'F3',
          title: 'Absolute path',
          severity: 'major',
          file: '/x.ts',
          line: 1,
          quote: 'anything',
          impact: 'Broken',
        },
      ],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.data.findings).toEqual([]);
    expect(result.discarded).toEqual([
      { id: 'F1', title: 'Out of lines', reason: 'line 999 is outside src/billing/total.ts (10 lines)' },
      { id: 'F2', title: 'Parent path', reason: 'invalid path: ../x.ts' },
      { id: 'F3', title: 'Absolute path', reason: 'invalid path: /x.ts' },
    ]);
  });

  it('discards a finding when rule_id is not among the selected rules', async () => {
    await writeRepoFile(root, 'src/a.ts', 'const x = 1;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [{
        id: 'F1',
        title: 'Unselected rule',
        severity: 'minor',
        file: 'src/a.ts',
        line: 1,
        quote: 'const x = 1;',
        impact: 'Minor',
        rule_id: 'SEC-999',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [ruleBiz003] });
    expect(result.data.findings).toEqual([]);
    expect(result.discarded).toEqual([{
      id: 'F1',
      title: 'Unselected rule',
      reason: 'rule SEC-999 is not among the selected rules',
    }]);
  });

  it('normalizes severity aliases case-insensitively and ignores extra whitespace', async () => {
    await writeRepoFile(root, 'src/a.ts', 'const a = 1;\nconst b = 2;\nconst c = 3;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [
        {
          id: 'F1',
          title: 'Grave',
          severity: '  GRAVE  ',
          file: 'src/a.ts',
          line: 1,
          quote: 'const a = 1;',
          impact: 'Impact',
        },
        {
          id: 'F2',
          title: 'Importante',
          severity: 'Importante',
          file: 'src/a.ts',
          line: 2,
          quote: 'const b = 2;',
          impact: 'Impact',
        },
        {
          id: 'F3',
          title: 'Menor',
          severity: 'menor',
          file: 'src/a.ts',
          line: 3,
          quote: 'const c = 3;',
          impact: 'Impact',
        },
      ],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([]);
    expect(result.data.findings.map((f) => f.severity)).toEqual(['critical', 'major', 'minor']);
  });

  it('verifies a multi-line quote spanning lines 3 to 5', async () => {
    await writeRepoFile(root, 'src/multi.ts', [
      '// line 1',
      '// line 2',
      'function compute() {',
      '  const factor = 1.16;',
      '  return factor;',
      '}',
    ].join('\n') + '\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [{
        id: 'F1',
        title: 'Multi line finding',
        severity: 'major',
        file: 'src/multi.ts',
        line: 3,
        end_line: 5,
        quote: 'function compute() {\nconst factor = 1.16;\nreturn factor;\n',
        impact: 'Impact',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([]);
    expect(result.data.findings.length).toBe(1);
  });

  it('retains only the first 5 ideas and records a note when 7 ideas are provided', async () => {
    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [],
      ideas: ['Idea 1', 'Idea 2', 'Idea 3', 'Idea 4', 'Idea 5', 'Idea 6', 'Idea 7'],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.data.ideas).toEqual(['Idea 1', 'Idea 2', 'Idea 3', 'Idea 4', 'Idea 5']);
    expect(result.notes.some((note) => note.includes('5 ideas') && note.includes('7'))).toBe(true);
  });

  it('parses input containing a UTF-8 BOM character at the start', async () => {
    const rawString = '\uFEFF' + JSON.stringify({
      schema_version: 1,
      summary: 'With BOM',
      findings: [],
    });

    const result = await validateFindings(rawString, { root, rules: [] });
    expect(result.data.summary).toBe('With BOM');
  });

  it('discards symlinks pointing outside the repository, .git paths, and paths with backslashes', async () => {
    const outsideFile = join(tmpdir(), `outside-${Date.now()}.ts`);
    await writeRepoFile(outsideFile, '', 'export const outside = true;\n');
    await symlink(outsideFile, join(root, 'symlink-outside.ts'));

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [
        {
          id: 'F1',
          title: 'Symlink escaping repo',
          severity: 'critical',
          file: 'symlink-outside.ts',
          line: 1,
          quote: 'outside',
          impact: 'Escapes repo',
        },
        {
          id: 'F2',
          title: 'Git config path',
          severity: 'critical',
          file: '.git/config',
          line: 1,
          quote: 'anything',
          impact: 'Accesses git directory',
        },
        {
          id: 'F3',
          title: 'Backslash path',
          severity: 'critical',
          file: 'src\\x.ts',
          line: 1,
          quote: 'anything',
          impact: 'Invalid path format',
        },
      ],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.data.findings).toEqual([]);
    expect(result.discarded).toEqual([
      { id: 'F1', title: 'Symlink escaping repo', reason: 'invalid path: symlink-outside.ts' },
      { id: 'F2', title: 'Git config path', reason: 'invalid path: .git/config' },
      { id: 'F3', title: 'Backslash path', reason: 'invalid path: src\\x.ts' },
    ]);
  });

  it('discards with "file not found" when a path component is not a directory (ENOTDIR)', async () => {
    await writeRepoFile(root, 'src/file.txt', 'just a regular file\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [{
        id: 'F1',
        title: 'ENOTDIR case',
        severity: 'minor',
        file: 'src/file.txt/nested.ts',
        line: 1,
        quote: 'anything',
        impact: 'Impact',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.data.findings).toEqual([]);
    expect(result.discarded).toEqual([{
      id: 'F1',
      title: 'ENOTDIR case',
      reason: 'file not found: src/file.txt/nested.ts',
    }]);
  });

  it('discards when end_line is before line, and accepts whole_file without line or quote check', async () => {
    await writeRepoFile(root, 'src/full.ts', 'line 1\nline 2\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [
        {
          id: 'F1',
          title: 'Inverted lines',
          severity: 'minor',
          file: 'src/full.ts',
          line: 5,
          end_line: 2,
          quote: 'line 1',
          impact: 'Impact',
        },
        {
          id: 'F2',
          title: 'Whole file finding',
          severity: 'major',
          file: 'src/full.ts',
          whole_file: true,
          quote: 'Arbitrary quote not checked',
          impact: 'Whole file issue',
        },
      ],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([{
      id: 'F1',
      title: 'Inverted lines',
      reason: 'end_line is before line',
    }]);
    expect(result.data.findings.length).toBe(1);
    expect(result.data.findings[0].wholeFile).toBe(true);
    expect(result.data.findings[0].line).toBeUndefined();
    expect(result.data.findings[0].endLine).toBeUndefined();
  });

  it('handles case-insensitive duplicate ids and cleans related_findings', async () => {
    await writeRepoFile(root, 'src/test.ts', 'const a = 1;\nconst b = 2;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [
        {
          id: 'F1',
          title: 'First finding',
          severity: 'critical',
          file: 'src/test.ts',
          line: 1,
          quote: 'const a = 1;',
          impact: 'Impact',
          related_findings: ['F1', 'f2', 'nonexistent'],
        },
        {
          id: 'f1',
          title: 'Duplicate lowercase id',
          severity: 'critical',
          file: 'src/test.ts',
          line: 2,
          quote: 'const b = 2;',
          impact: 'Impact',
        },
        {
          id: 'F2',
          title: 'Second finding to be discarded',
          severity: 'critical',
          file: 'src/test.ts',
          line: 99,
          quote: 'missing',
          impact: 'Impact',
        },
      ],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([
      { id: 'f1', title: 'Duplicate lowercase id', reason: 'duplicate id: f1' },
      { id: 'F2', title: 'Second finding to be discarded', reason: 'line 99 is outside src/test.ts (2 lines)' },
    ]);
    expect(result.data.findings.length).toBe(1);
    // 'F1' references itself (removed), 'f2' was discarded (removed), 'nonexistent' nonexistent (removed)
    expect(result.data.findings[0].relatedFindings).toEqual([]);
  });

  it('normalizes criteria statuses, defaults missing criteria to not_evaluated, notes invalid numbers, and handles missing task', async () => {
    const raw = {
      schema_version: 1,
      summary: 'Summary',
      criteria: [
        { number: 1, status: 'met' },
        { number: 2, status: 'partial', reason: 'Partially done' },
        { number: 9, status: 'not_met' },
      ],
      findings: [],
    };

    const resultWithTask = await validateFindings(raw, {
      root,
      rules: [],
      task: sampleTask,
    });

    expect(resultWithTask.data.criteria).toEqual([
      { number: 1, text: 'Botón «Pagar» visible en el checkout.', status: 'met' },
      { number: 2, text: 'Total con IVA calculado en centavos.', status: 'partial', reason: 'Partially done' },
      { number: 3, text: 'Mensaje si el cobro falla, con opción de reintentar.', status: 'not_evaluated' },
    ]);
    expect(resultWithTask.notes.some((note) => note.includes('9'))).toBe(true);

    const resultNoTask = await validateFindings(raw, {
      root,
      rules: [],
      task: undefined,
    });
    expect(resultNoTask.data.criteria).toEqual([]);
  });

  it('cleans invalid type for optional fields like verified and notes the issue while keeping finding', async () => {
    await writeRepoFile(root, 'src/test.ts', 'const a = 1;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [{
        id: 'F1',
        title: 'Finding with string verified',
        severity: 'minor',
        file: 'src/test.ts',
        line: 1,
        quote: 'const a = 1;',
        impact: 'Impact',
        verified: 'sí',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([]);
    expect(result.data.findings.length).toBe(1);
    expect(result.data.findings[0].verified).toBe(false);
    expect(result.notes.some((note) => note.includes('verified'))).toBe(true);
  });

  it('removes invalid out_of_scope entry with parent path traversal and notes the issue', async () => {
    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [],
      out_of_scope: [{ file: '../x.ts', line: 1, note: 'Out of repo' }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.data.outOfScope).toEqual([]);
    expect(result.notes.some((note) => note.includes('../x.ts'))).toBe(true);
  });

  it('orders findings by severity, file, and line deterministically', async () => {
    await writeRepoFile(root, 'src/b.ts', 'const b1 = 1;\nconst b2 = 2;\n');
    await writeRepoFile(root, 'src/a.ts', 'const a1 = 1;\nconst a2 = 2;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [
        { id: 'F1', title: 'Minor A', severity: 'minor', file: 'src/a.ts', line: 1, quote: 'const a1 = 1;', impact: 'i' },
        { id: 'F2', title: 'Critical B 2', severity: 'critical', file: 'src/b.ts', line: 2, quote: 'const b2 = 2;', impact: 'i' },
        { id: 'F3', title: 'Major A', severity: 'major', file: 'src/a.ts', line: 2, quote: 'const a2 = 2;', impact: 'i' },
        { id: 'F4', title: 'Critical A', severity: 'critical', file: 'src/a.ts', line: 1, quote: 'const a1 = 1;', impact: 'i' },
        { id: 'F5', title: 'Critical B wholeFile', severity: 'critical', file: 'src/b.ts', whole_file: true, quote: 'q', impact: 'i' },
      ],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.data.findings.map((f) => f.id)).toEqual([
      'F4', // critical, src/a.ts, line 1
      'F5', // critical, src/b.ts, wholeFile
      'F2', // critical, src/b.ts, line 2
      'F3', // major, src/a.ts, line 2
      'F1', // minor, src/a.ts, line 1
    ]);
  });

  it('discards non-object findings, invalid required fields, and generates positional ids for discarded entries lacking id/title', async () => {
    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [
        'not an object',
        { id: '', title: 'Missing id', severity: 'minor', file: 'a.ts', line: 1, quote: 'q', impact: 'i' },
        { id: 'F1', title: '', severity: 'minor', file: 'a.ts', line: 1, quote: 'q', impact: 'i' },
        { id: 'F2', title: 'Missing impact', severity: 'minor', file: 'a.ts', line: 1, quote: 'q', impact: '' },
        { id: 'F3', title: 'Missing line', severity: 'minor', file: 'a.ts', quote: 'q', impact: 'i' },
        { id: 'F4', title: 'Invalid severity value', severity: 'unsupported_val', file: 'a.ts', line: 1, quote: 'q', impact: 'i' },
      ],
      discarded: [
        { id: '', reason: 'Session discarded item' },
      ],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([
      { id: '#1', title: '', reason: 'finding is not an object' },
      { id: '#2', title: 'Missing id', reason: 'missing or invalid field: id' },
      { id: 'F1', title: '', reason: 'missing or invalid field: title' },
      { id: 'F2', title: 'Missing impact', reason: 'missing or invalid field: impact' },
      { id: 'F3', title: 'Missing line', reason: 'missing or invalid field: line' },
      { id: 'F4', title: 'Invalid severity value', reason: 'invalid severity: unsupported_val' },
    ]);
    expect(result.data.discarded).toEqual([
      { id: '#1', title: '', reason: 'Session discarded item' },
    ]);
  });

  it('accepts null in optional fields without discarding findings or creating notes', async () => {
    await writeRepoFile(root, 'src/test.ts', 'const a = 1;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary with null optionals',
      criteria: null,
      out_of_scope: null,
      ideas: null,
      suggested_rules: null,
      impact: null,
      discarded: null,
      findings: [{
        id: 'F1',
        title: 'Finding with null optionals',
        severity: 'minor',
        file: 'src/test.ts',
        line: 1,
        end_line: null,
        rule_id: null,
        suggestion: null,
        existing: null,
        related_note: null,
        related_findings: null,
        related_criteria: null,
        verified: null,
        quote: 'const a = 1;',
        impact: 'Impact',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(result.data.findings.length).toBe(1);
    expect(result.data.findings[0].endLine).toBe(1);
    expect(result.data.findings[0].verified).toBe(false);
    expect(result.data.findings[0].relatedFindings).toEqual([]);
    expect(result.data.findings[0].relatedCriteria).toEqual([]);
    expect(result.data.findings[0].ruleId).toBeUndefined();
    expect(result.data.findings[0].suggestion).toBeUndefined();
    expect(result.data.findings[0].existing).toBeUndefined();
    expect(result.data.findings[0].relatedNote).toBeUndefined();
    expect(result.data.criteria).toEqual([]);
    expect(result.data.outOfScope).toEqual([]);
    expect(result.data.ideas).toEqual([]);
    expect(result.data.suggestedRules).toEqual([]);
    expect(result.data.impact).toEqual([]);
    expect(result.data.discarded).toEqual([]);
  });

  it('accepts a file whose name starts with .. like ..foo.ts within the repository', async () => {
    await writeRepoFile(root, '..foo.ts', 'const a = 1;\n');

    const raw = {
      schema_version: 1,
      summary: 'Summary',
      findings: [{
        id: 'F1',
        title: 'File starting with double dot',
        severity: 'minor',
        file: '..foo.ts',
        line: 1,
        quote: 'const a = 1;',
        impact: 'Impact',
      }],
    };

    const result = await validateFindings(raw, { root, rules: [] });
    expect(result.discarded).toEqual([]);
    expect(result.data.findings.length).toBe(1);
    expect(result.data.findings[0].file).toBe('..foo.ts');
  });
});
