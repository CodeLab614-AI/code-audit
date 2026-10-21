import { describe, expect, it } from 'bun:test';
import type { Task } from '../config/task.js';
import type { FindingsData } from '../findings/schema.js';
import type { ReviewRange } from '../review/types.js';
import type { SelectedRule } from '../review/select.js';
import { createRepo, writeRepoFile, removeRepo } from '../test-helpers/repo.js';
import { TEXTS } from './i18n.js';
import {
  buildReportModel,
  computeTitle,
  computeVerdict,
  formatReportDate,
} from './model.js';

describe('computeVerdict', () => {
  it('returns approved when there are only minor findings', () => {
    expect(computeVerdict([{ severity: 'minor' }])).toBe('approved');
    expect(computeVerdict([])).toBe('approved');
  });

  it('returns not_approved when a major finding is present', () => {
    expect(computeVerdict([{ severity: 'minor' }, { severity: 'major' }])).toBe('not_approved');
  });

  it('returns not_approved when a critical finding is present', () => {
    expect(computeVerdict([{ severity: 'critical' }])).toBe('not_approved');
  });
});

describe('computeTitle', () => {
  it('extracts the first sentence up to punctuation followed by space or end', () => {
    const task: Task = {
      file: 'tasks/PAY-123.md',
      objective: 'Botón de pago en el checkout. Usa el componente.',
      criteria: ['Criterio 1'],
    };
    expect(computeTitle(task, 'feat', 'a1b2c3d', TEXTS.es)).toBe('Botón de pago en el checkout');
  });

  it('truncates at the last space before 80 characters with ellipsis', () => {
    const longSentence = 'Este es un objetivo sumamente largo para probar el corte de caracteres que definitivamente excede el limite maximo permitido en el diseno.';
    const task: Task = {
      file: 'tasks/LONG.md',
      objective: `${longSentence} Segunda oracion.`,
      criteria: ['Criterio 1'],
    };
    const title = computeTitle(task, 'feat', 'a1b2c3d', TEXTS.es);
    expect(title.endsWith('…')).toBe(true);
    expect(Array.from(title).length).toBeLessThanOrEqual(80);
    expect(title).toBe('Este es un objetivo sumamente largo para probar el corte de caracteres que…');
  });

  it('preserves ? and ! when sentence ends with them and only removes trailing period', () => {
    const taskQ: Task = {
      file: 'tasks/Q.md',
      objective: '¿Funciona el pago? Sí.',
      criteria: [],
    };
    expect(computeTitle(taskQ, 'feat', 'a1b2c3d', TEXTS.es)).toBe('¿Funciona el pago?');

    const taskExcl: Task = {
      file: 'tasks/EXCL.md',
      objective: '¡Listo! Ya.',
      criteria: [],
    };
    expect(computeTitle(taskExcl, 'feat', 'a1b2c3d', TEXTS.es)).toBe('¡Listo!');

    const taskPeriod: Task = {
      file: 'tasks/COFFEE.md',
      objective: 'Pagar 1.5 kg de café. Luego más.',
      criteria: [],
    };
    expect(computeTitle(taskPeriod, 'feat', 'a1b2c3d', TEXTS.es)).toBe('Pagar 1.5 kg de café');
  });

  it('caps at exactly 80 characters counting ellipsis when objective has no spaces', () => {
    const task100: Task = {
      file: 'tasks/NO_SPACES.md',
      objective: 'a'.repeat(100),
      criteria: [],
    };
    const title = computeTitle(task100, 'main', 'a1b2c3d', TEXTS.es);
    expect(Array.from(title).length).toBe(80);
    expect(title).toBe('a'.repeat(79) + '…');
  });

  it('uses branch or short sha when objective is missing or empty', () => {
    expect(computeTitle(undefined, 'feature/foo', 'a1b2c3d', TEXTS.es)).toBe('Revisión de feature/foo');
    expect(computeTitle(undefined, null, 'a1b2c3d', TEXTS.es)).toBe('Revisión de a1b2c3d');
    expect(computeTitle(undefined, 'feature/foo', 'a1b2c3d', TEXTS.en)).toBe('Review of feature/foo');
    expect(computeTitle(undefined, null, 'a1b2c3d', TEXTS.en)).toBe('Review of a1b2c3d');

    const emptyTask: Task = { file: 'tasks/empty.md', objective: '   ', criteria: [] };
    expect(computeTitle(emptyTask, 'main', 'a1b2c3d', TEXTS.es)).toBe('Revisión de main');
  });
});

describe('formatReportDate', () => {
  it('formats dates in Mexico City time zone in Spanish', () => {
    const formatted = formatReportDate('2026-10-18T21:32:00Z', 'America/Mexico_City', 'es', TEXTS.es);
    expect(formatted).toBe('18 de octubre de 2026, 15:32');
  });

  it('formats dates in English', () => {
    const formatted = formatReportDate('2026-10-18T21:32:00Z', 'America/Mexico_City', 'en', TEXTS.en);
    expect(formatted).toBe('October 18, 2026, 15:32');
  });
});

describe('buildReportModel', () => {
  it('builds a complete ReportModel with today, suggestion, wholeFile, and details', async () => {
    const root = await createRepo();
    try {
      // Create test files
      // 1. 50-line file for line 41 test and line 50 test
      const file50Lines = Array.from({ length: 50 }, (_, i) => `line_${i + 1}`).join('\n');
      await writeRepoFile(root, 'src/fifty.ts', file50Lines);

      // 2. 10-line file for line 1 test
      const file10Lines = Array.from({ length: 10 }, (_, i) => `line_${i + 1}`).join('\n');
      await writeRepoFile(root, 'src/ten.ts', file10Lines);

      // 3. File with CRLF
      const crlfContent = 'line_1\r\nline_2\r\nline_3\r\nline_4\r\nline_5\r\n';
      await writeRepoFile(root, 'src/crlf.ts', crlfContent);

      // 4. 450-line file for whole-file truncation
      const file450Lines = Array.from({ length: 450 }, (_, i) => `content_${i + 1}`).join('\n');
      await writeRepoFile(root, 'src/big.ts', file450Lines);

      // 5. 31-line file for whole-file untruncated
      const file31Lines = Array.from({ length: 31 }, (_, i) => `money_${i + 1}`).join('\n');
      await writeRepoFile(root, 'src/formatMoney.ts', file31Lines);

      // 6. File for suggestion test
      const fileSuggestion = 'const a = 1\nconst b = 2\nconst c = 3\n';
      await writeRepoFile(root, 'src/suggest.ts', fileSuggestion);

      // 7. Out of scope file
      await writeRepoFile(root, 'src/session.ts', 'session_code\n');

      // 8. Clean file without problems
      await writeRepoFile(root, 'src/clean.ts', 'clean_code\n');

    const sampleRange: ReviewRange = {
      mode: 'branch',
      branch: 'feature/PAY-123',
      baseLabel: 'main',
      baseSha: 'a1b2c3d4e5f60000000000000000000000000000',
      headSha: '9f8e7d65c4b30000000000000000000000000000',
      commits: [
        { sha: '1111111111111111111111111111111111111111', subject: 'feat: pay button' },
      ],
      files: [
        {
          path: 'src/fifty.ts',
          status: 'modified',
          added: 5,
          removed: 2,
          binary: false,
          committed: true,
          uncommitted: false,
        },
        {
          path: 'src/session.ts',
          status: 'modified',
          added: 1,
          removed: 0,
          binary: false,
          committed: true,
          uncommitted: false,
        },
        {
          path: 'src/clean.ts',
          status: 'modified',
          added: 2,
          removed: 0,
          binary: false,
          committed: true,
          uncommitted: false,
        },
        {
          path: 'src/deleted.ts',
          status: 'deleted',
          added: 0,
          removed: 10,
          binary: false,
          committed: true,
          uncommitted: false,
        },
      ],
      ignoredByConfig: ['ignored.log'],
      added: 8,
      removed: 12,
      large: true,
    };

    const sampleRules: SelectedRule[] = [
      {
        rule: {
          id: 'POL-001',
          title: 'Regla de políticas',
          severity: 'critical',
          appliesTo: ['**/*'],
          keywords: [],
          kind: 'policy',
          file: '.agents/code-audit/rules/policy/POL-001.md',
          body: 'body',
        },
        reasons: [{ type: 'policy' }],
      },
    ];

    const sampleTask: Task = {
      file: 'tasks/PAY-123.md',
      objective: 'Botón de pago en el checkout. Usa el componente.',
      criteria: [
        'Botón visible en checkout',
        'Total con IVA calculado en centavos',
        'Mensaje si falla',
      ],
    };

    const sampleData: FindingsData = {
      schemaVersion: 1,
      summary: 'Resumen de la revisión.',
      criteria: [
        { number: 1, text: 'Botón visible', status: 'met' },
        { number: 2, text: 'Total con IVA', status: 'not_met', reason: 'Lo calcula con decimales.' },
        { number: 3, text: 'Mensaje si falla', status: 'partial', reason: 'No deja reintentar.' },
      ],
      findings: [
        {
          id: 'F1',
          title: 'Problema en línea 41',
          severity: 'major',
          file: 'src/fifty.ts',
          quote: 'line_41',
          impact: 'Impacto 1',
          verified: true,
          wholeFile: false,
          line: 41,
          endLine: 41,
          ruleId: 'POL-001',
          relatedFindings: ['F3'],
          relatedCriteria: [2],
          relatedNote: 'Nota relacionada',
        },
        {
          id: 'F2',
          title: 'Problema en línea 1',
          severity: 'major',
          file: 'src/ten.ts',
          quote: 'line_1',
          impact: 'Impacto 2',
          verified: false,
          wholeFile: false,
          line: 1,
          endLine: 1,
          relatedFindings: [],
          relatedCriteria: [],
        },
        {
          id: 'F3',
          title: 'Problema en línea final 50',
          severity: 'major',
          file: 'src/fifty.ts',
          quote: 'line_50',
          impact: 'Impacto 3',
          verified: true,
          wholeFile: false,
          line: 50,
          endLine: 50,
          relatedFindings: [],
          relatedCriteria: [],
        },
        {
          id: 'F4',
          title: 'Problema en archivo CRLF',
          severity: 'major',
          file: 'src/crlf.ts',
          quote: 'line_3',
          impact: 'Impacto CRLF',
          verified: true,
          wholeFile: false,
          line: 3,
          endLine: 3,
          relatedFindings: [],
          relatedCriteria: [],
        },
        {
          id: 'F5',
          title: 'Archivo completo 450 líneas',
          severity: 'major',
          file: 'src/big.ts',
          quote: '',
          impact: 'Impacto big',
          verified: true,
          wholeFile: true,
          relatedFindings: [],
          relatedCriteria: [],
        },
        {
          id: 'F6',
          title: 'Archivo completo 31 líneas',
          severity: 'major',
          file: 'src/formatMoney.ts',
          quote: '',
          impact: 'Impacto 31',
          verified: true,
          wholeFile: true,
          relatedFindings: [],
          relatedCriteria: [],
        },
        {
          id: 'F7',
          title: 'Problema menor de formato',
          severity: 'minor',
          file: 'src/fifty.ts',
          quote: 'line_38',
          impact: 'Impacto menor',
          verified: false,
          wholeFile: false,
          line: 38,
          endLine: 38,
          relatedFindings: [],
          relatedCriteria: [],
        },
        {
          id: 'F8',
          title: 'Problema con sugerencia',
          severity: 'major',
          file: 'src/suggest.ts',
          quote: 'const b = 2',
          impact: 'Impacto sugerencia',
          verified: true,
          wholeFile: false,
          line: 2,
          endLine: 2,
          suggestion: {
            startLine: 2,
            code: 'const b = 2\nconst c_modified = 3\nconst d_extra = 4',
          },
          relatedFindings: [],
          relatedCriteria: [],
        },
      ],
      outOfScope: [{ file: 'src/session.ts', line: 88, note: 'Sesiones de usuario' }],
      ideas: ['Idea 1', 'Idea 2'],
      suggestedRules: [
        { text: 'Todo botón se desactiva mientras espera respuesta', fromFinding: 'F2' },
      ],
      impact: ['El total también lo usan facturas.'],
      discarded: [{ id: 'F9', title: 'Descartado', reason: 'Ya existía' }],
    };

    const model = await buildReportModel({
      root,
      runId: '20261018-213200-9f8e7d6',
      createdAt: '2026-10-18T21:32:00Z',
      timeZone: 'America/Mexico_City',
      language: 'fr',
      range: sampleRange,
      rules: { selected: sampleRules, total: 152 },
      task: sampleTask,
      data: sampleData,
      discarded: [{ id: 'F0', title: 'Descartado en validacion', reason: 'Fuera de rango' }],
      notes: ['Nota de validacion'],
      configProblems: [],
      sessions: ['hallazgos importados de findings.json'],
    });

    // Language fallback
    expect(model.ui).toBe('en');
    expect(model.details.languageFallback).toBe('fr');

    // Title and taskId
    expect(model.title).toBe('Botón de pago en el checkout');
    expect(model.taskId).toBe('PAY-123');
    expect(model.headShort).toBe('9f8e7d6');
    expect(model.verdict).toBe('not_approved');
    expect(model.large).toBe(true);

    // Criteria
    expect(model.criteria.evaluated).toBe(true);
    expect(model.criteria.met).toBe(1);
    expect(model.criteria.total).toBe(3);

    // Finding 1: Line 41 in 50-line file gives lines 39 to 43 with 41 marked
    const f1 = model.findings[0]!;
    expect(f1.number).toBe(1);
    expect(f1.id).toBe('F1');
    expect(f1.today).toBeDefined();
    expect(f1.today!.map((l) => l.number)).toEqual([39, 40, 41, 42, 43]);
    expect(f1.today!.find((l) => l.number === 41)?.marked).toBe(true);
    expect(f1.today!.find((l) => l.number === 40)?.marked).toBe(false);
    expect(f1.rule?.id).toBe('POL-001');
    expect(f1.related.findings).toEqual([{ number: 3, title: 'Problema en línea final 50' }]);
    expect(f1.related.criteria).toEqual([{ number: 2, status: 'not_met' }]);

    // Finding 2: Line 1 in 10-line file starts at line 1
    const f2 = model.findings[1]!;
    expect(f2.today).toBeDefined();
    expect(f2.today!.map((l) => l.number)).toEqual([1, 2, 3]);
    expect(f2.suggestedRuleBelow).toBe(true);

    // Finding 3: Line 50 in 50-line file ends at line 50
    const f3 = model.findings[2]!;
    expect(f3.today!.map((l) => l.number)).toEqual([48, 49, 50]);

    // Finding 4: CRLF file has no trailing \r in line texts
    const f4 = model.findings[3]!;
    for (const line of f4.today!) {
      expect(line.text.includes('\r')).toBe(false);
    }

    // Finding 5: 450 lines wholeFile gives 400 lines and truncated true
    const f5 = model.findings[4]!;
    expect(f5.today).toBeUndefined();
    expect(f5.wholeFileView).toBeDefined();
    expect(f5.wholeFileView!.total).toBe(450);
    expect(f5.wholeFileView!.truncated).toBe(true);
    expect(f5.wholeFileView!.lines.length).toBe(400);
    expect(f5.certainty).toContain('The file exists.');

    // Finding 6: 31 lines wholeFile gives 31 lines and truncated false
    const f6 = model.findings[5]!;
    expect(f6.wholeFileView!.total).toBe(31);
    expect(f6.wholeFileView!.truncated).toBe(false);
    expect(f6.wholeFileView!.lines.length).toBe(31);

    // Finding 7: Minor finding has no today and no suggestion
    const f7 = model.findings[6]!;
    expect(f7.severity).toBe('minor');
    expect(f7.today).toBeUndefined();
    expect(f7.suggestion).toBeUndefined();

    // Finding 8: Suggestion lines marking
    const f8 = model.findings[7]!;
    expect(f8.suggestion).toBeDefined();
    // Line 2 was "const b = 2" in file, so it matches -> marked: false
    // Line 3 was "const c = 3" in file, suggestion has "const c_modified = 3" -> marked: true
    // Line 4 does not exist in file -> marked: true
    expect(f8.suggestion!).toEqual([
      { number: 2, text: 'const b = 2', marked: false },
      { number: 3, text: 'const c_modified = 3', marked: true },
      { number: 4, text: 'const d_extra = 4', marked: true },
    ]);

    // Suggested rules fromNumber
    expect(model.suggestedRules).toEqual([
      { text: 'Todo botón se desactiva mientras espera respuesta', fromNumber: 2 },
    ]);

    // Files in details
    const files = model.details.files;
    expect(files.find((f) => f.path === 'src/fifty.ts')).toEqual({
      path: 'src/fifty.ts',
      status: 'modified',
      problems: [1, 3, 7],
      outOfScope: false,
    });
    expect(files.find((f) => f.path === 'src/session.ts')).toEqual({
      path: 'src/session.ts',
      status: 'modified',
      problems: [],
      outOfScope: true,
    });
    expect(files.find((f) => f.path === 'src/clean.ts')).toEqual({
      path: 'src/clean.ts',
      status: 'modified',
      problems: [],
      outOfScope: false,
    });
    expect(files.find((f) => f.path === 'src/deleted.ts')).toEqual({
      path: 'src/deleted.ts',
      status: 'deleted',
      problems: [],
      outOfScope: false,
    });

    // Discarded collections
    expect(model.details.discardedBySession).toEqual(sampleData.discarded);
    expect(model.details.discardedByValidation).toEqual([
      { id: 'F0', title: 'Descartado en validacion', reason: 'Fuera de rango' },
    ]);
    } finally {
      await removeRepo(root);
    }
  });

  it('handles report without a task specification', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'src/app.ts', 'console.log("ok");\n');

    const sampleRange: ReviewRange = {
      mode: 'branch',
      branch: 'main',
      baseLabel: 'origin/main',
      baseSha: 'a1b2c3d4e5f60000000000000000000000000000',
      headSha: '9f8e7d65c4b30000000000000000000000000000',
      commits: [],
      files: [],
      ignoredByConfig: [],
      added: 0,
      removed: 0,
      large: false,
    };

    const emptyData: FindingsData = {
      schemaVersion: 1,
      summary: 'Sin ficha.',
      criteria: [],
      findings: [],
      outOfScope: [],
      ideas: [],
      suggestedRules: [],
      impact: [],
      discarded: [],
    };

    const model = await buildReportModel({
      root,
      runId: '20261018-213200-9f8e7d6',
      createdAt: '2026-10-18T21:32:00Z',
      language: 'es',
      range: sampleRange,
      rules: { selected: [], total: 10 },
      data: emptyData,
      discarded: [],
      notes: [],
      configProblems: [],
      sessions: [],
    });

    expect(model.title).toBe('Revisión de main');
    expect(model.taskId).toBeUndefined();
    expect(model.criteria).toEqual({
      evaluated: false,
      items: [],
      met: 0,
      total: 0,
    });
    expect(model.verdict).toBe('approved');
    expect(model.details.languageFallback).toBeNull();
    } finally {
      await removeRepo(root);
    }
  });

  it('handles a task with empty criteria without evaluating to criteriaNoTask', async () => {
    const root = await createRepo();
    try {
      await writeRepoFile(root, 'src/app.ts', 'console.log("ok");\n');

      const sampleRange: ReviewRange = {
        mode: 'branch',
        branch: 'main',
        baseLabel: 'origin/main',
        baseSha: 'a1b2c3d4e5f60000000000000000000000000000',
        headSha: '9f8e7d65c4b30000000000000000000000000000',
        commits: [],
        files: [],
        ignoredByConfig: [],
        added: 0,
        removed: 0,
        large: false,
      };

      const emptyData: FindingsData = {
        schemaVersion: 1,
        summary: 'Ficha sin criterios.',
        criteria: [],
        findings: [],
        outOfScope: [],
        ideas: [],
        suggestedRules: [],
        impact: [],
        discarded: [],
      };

      const taskWithEmptyCriteria: Task = {
        file: 'tasks/TASK-EMPTY.md',
        objective: 'Objetivo de prueba.',
        criteria: [],
      };

      const model = await buildReportModel({
        root,
        runId: '20261018-213200-9f8e7d6',
        createdAt: '2026-10-18T21:32:00Z',
        language: 'es',
        range: sampleRange,
        rules: { selected: [], total: 10 },
        task: taskWithEmptyCriteria,
        data: emptyData,
        discarded: [],
        notes: [],
        configProblems: [],
        sessions: [],
      });

      expect(model.taskId).toBe('TASK-EMPTY');
      expect(model.criteria.evaluated).toBe(true);
      expect(model.criteria.total).toBe(0);
      expect(model.criteria.met).toBe(0);
      // The view uses criteriaNone when evaluated && total === 0, not criteriaNoTask
      const displayCriteria = !model.criteria.evaluated
        ? model.texts.criteriaNoTask
        : model.criteria.total === 0
          ? model.texts.criteriaNone
          : model.texts.criteriaMet(model.criteria.met, model.criteria.total);
      expect(displayCriteria).toBe(model.texts.criteriaNone);
      expect(displayCriteria).toBe('La tarea no tiene criterios.');
      expect(displayCriteria).not.toBe(model.texts.criteriaNoTask);
    } finally {
      await removeRepo(root);
    }
  });
});
