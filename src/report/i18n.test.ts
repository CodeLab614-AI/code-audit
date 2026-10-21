import { describe, expect, it } from 'bun:test';
import { resolveReportLanguage, TEXTS, type ReportTexts } from './i18n.js';

describe('resolveReportLanguage', () => {
  it('resolves Spanish locales without fallback', () => {
    expect(resolveReportLanguage('es')).toEqual({ ui: 'es', fallback: false });
    expect(resolveReportLanguage('es-MX')).toEqual({ ui: 'es', fallback: false });
    expect(resolveReportLanguage('ES')).toEqual({ ui: 'es', fallback: false });
    expect(resolveReportLanguage('  es-CO  ')).toEqual({ ui: 'es', fallback: false });
  });

  it('resolves English locales without fallback', () => {
    expect(resolveReportLanguage('en')).toEqual({ ui: 'en', fallback: false });
    expect(resolveReportLanguage('en-GB')).toEqual({ ui: 'en', fallback: false });
    expect(resolveReportLanguage('EN-US')).toEqual({ ui: 'en', fallback: false });
    expect(resolveReportLanguage('  en  ')).toEqual({ ui: 'en', fallback: false });
  });

  it('falls back to English for unsupported languages with original flag', () => {
    expect(resolveReportLanguage('fr')).toEqual({ ui: 'en', fallback: true });
    expect(resolveReportLanguage('de')).toEqual({ ui: 'en', fallback: true });
    expect(resolveReportLanguage('ja')).toEqual({ ui: 'en', fallback: true });
    expect(resolveReportLanguage('')).toEqual({ ui: 'en', fallback: true });
  });
});

describe('TEXTS', () => {
  it('provides identical keys for both supported languages', () => {
    const enKeys = Object.keys(TEXTS.en).sort();
    const esKeys = Object.keys(TEXTS.es).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it('contains no empty string entries in any language', () => {
    for (const lang of ['en', 'es'] as const) {
      const texts = TEXTS[lang] as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(texts)) {
        if (typeof value === 'string') {
          expect(value.trim().length).toBeGreaterThan(0);
        } else if (typeof value === 'object' && value !== null) {
          for (const [subKey, subVal] of Object.entries(value as Record<string, string>)) {
            expect(typeof subVal).toBe('string');
            expect(subVal.trim().length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('returns non-empty strings from all text formatting functions', () => {
    const sampleRange = {
      branch: 'feature/PAY-123',
      baseLabel: 'main',
      baseShort: 'a1b2c3d',
      headShort: '9f8e7d6',
      commitsCount: 4,
      uncommittedFilesCount: 1,
      filesCount: 7,
      added: 214,
      removed: 38,
    };

    const sampleDateParts = {
      day: '18',
      month: 'octubre',
      year: '2026',
      hour: '15',
      minute: '32',
    };

    for (const lang of ['en', 'es'] as const) {
      const t = TEXTS[lang];
      expect(t.verdictAria(true).trim().length).toBeGreaterThan(0);
      expect(t.verdictAria(false).trim().length).toBeGreaterThan(0);
      expect(t.headerMeta('PAY-123', 'feat', 'hoy').trim().length).toBeGreaterThan(0);
      expect(t.headerMeta(undefined, null, 'hoy').trim().length).toBeGreaterThan(0);
      expect(t.titleWithoutTask('main').trim().length).toBeGreaterThan(0);
      expect(t.formatDate(sampleDateParts).trim().length).toBeGreaterThan(0);
      expect(t.criteriaMet(1, 3).trim().length).toBeGreaterThan(0);
      expect(t.criteriaMet(0, 0).trim().length).toBeGreaterThan(0);
      expect(t.issuesSub(1).trim().length).toBeGreaterThan(0);
      expect(t.issuesSub(5).trim().length).toBeGreaterThan(0);
      expect(t.certainty(true, false).trim().length).toBeGreaterThan(0);
      expect(t.certainty(false, true).trim().length).toBeGreaterThan(0);
      expect(t.wholeFileSummary(31).trim().length).toBeGreaterThan(0);
      expect(t.fileLineLabel('src/a.ts', 41).trim().length).toBeGreaterThan(0);
      expect(t.fileLineLabel('src/a.ts', undefined).trim().length).toBeGreaterThan(0);
      expect(t.wholeFileLabel('nuevo', 31).trim().length).toBeGreaterThan(0);
      expect(t.relatedCriterion(2, 'No cumplido').trim().length).toBeGreaterThan(0);
      expect(t.relatedFinding(3, 'Otro').trim().length).toBeGreaterThan(0);
      expect(t.outOfScopeNote('src/s.ts', 88, 'sesiones').trim().length).toBeGreaterThan(0);
      expect(t.outOfScopeNote('src/s.ts', undefined, 'sesiones').trim().length).toBeGreaterThan(0);
      expect(t.suggestedRuleText('regla', 2).trim().length).toBeGreaterThan(0);
      expect(t.suggestedRuleText('regla', undefined).trim().length).toBeGreaterThan(0);
      expect(t.rangeBranch(sampleRange).trim().length).toBeGreaterThan(0);
      expect(t.rangeUnpushed(sampleRange).trim().length).toBeGreaterThan(0);
      expect(t.rangeSinceRun(sampleRange).trim().length).toBeGreaterThan(0);
      expect(t.rangeSinceRef(sampleRange).trim().length).toBeGreaterThan(0);
      expect(t.rulesUsed(9, 152).trim().length).toBeGreaterThan(0);
      expect(t.reasonAppliesTo('*.ts', ['src/a.ts']).trim().length).toBeGreaterThan(0);
      expect(t.reasonKeyword('cobro', 'changes').trim().length).toBeGreaterThan(0);
      expect(t.importedSession('findings.json').trim().length).toBeGreaterThan(0);
      expect(t.discardedByVerifier(2).trim().length).toBeGreaterThan(0);
      expect(t.discardedByValidation(1).trim().length).toBeGreaterThan(0);
      expect(t.languageFallbackNote('fr').trim().length).toBeGreaterThan(0);
      expect(t.fileProblems([]).trim().length).toBeGreaterThan(0);
      expect(t.fileProblems([1]).trim().length).toBeGreaterThan(0);
      expect(t.fileProblems([1, 5]).trim().length).toBeGreaterThan(0);
    }
  });
});

describe('criteria text formatting', () => {
  it('formats criteriaMet with correct plural agreements in Spanish', () => {
    expect(TEXTS.es.criteriaMet(1, 3)).toBe('1 de 3 criterios cumplidos.');
    expect(TEXTS.es.criteriaMet(1, 1)).toBe('1 de 1 criterio cumplido.');
    expect(TEXTS.es.criteriaMet(0, 2)).toBe('0 de 2 criterios cumplidos.');
    expect(TEXTS.es.criteriaMet(2, 2)).toBe('2 de 2 criterios cumplidos.');
  });

  it('formats criteriaMet with correct plural agreements in English', () => {
    expect(TEXTS.en.criteriaMet(1, 3)).toBe('1 of 3 criteria met.');
    expect(TEXTS.en.criteriaMet(1, 1)).toBe('1 of 1 criterion met.');
    expect(TEXTS.en.criteriaMet(0, 2)).toBe('0 of 2 criteria met.');
    expect(TEXTS.en.criteriaMet(2, 2)).toBe('2 of 2 criteria met.');
  });

  it('provides criteriaNone and criteriaNoTask in both languages', () => {
    expect(TEXTS.es.criteriaNone).toBe('La tarea no tiene criterios.');
    expect(TEXTS.en.criteriaNone).toBe('The task has no criteria.');
    expect(TEXTS.es.criteriaNoTask).toBe('sin tarea: no evaluado');
    expect(TEXTS.en.criteriaNoTask).toBe('no task: not evaluated');
  });
});

describe('range description formatting', () => {
  const baseRange = {
    branch: 'feat/checkout',
    baseLabel: 'origin/main',
    baseShort: 'a1b2c3d',
    headShort: '9f8e7d6',
    commitsCount: 2,
    uncommittedFilesCount: 0,
    filesCount: 3,
  };

  it('formats singular and plural line counts in Spanish', () => {
    const range1 = { ...baseRange, added: 1, removed: 1 };
    expect(TEXTS.es.rangeBranch(range1)).toContain('1 línea agregada y 1 quitada.');
    expect(TEXTS.es.rangeUnpushed(range1)).toContain('1 línea agregada y 1 quitada.');
    expect(TEXTS.es.rangeSinceRun(range1)).toContain('1 línea agregada y 1 quitada.');
    expect(TEXTS.es.rangeSinceRef(range1)).toContain('1 línea agregada y 1 quitada.');

    const range7 = { ...baseRange, added: 7, removed: 2 };
    expect(TEXTS.es.rangeBranch(range7)).toContain('7 líneas agregadas y 2 quitadas.');
    expect(TEXTS.es.rangeUnpushed(range7)).toContain('7 líneas agregadas y 2 quitadas.');
    expect(TEXTS.es.rangeSinceRun(range7)).toContain('7 líneas agregadas y 2 quitadas.');
    expect(TEXTS.es.rangeSinceRef(range7)).toContain('7 líneas agregadas y 2 quitadas.');
  });

  it('formats singular and plural line counts in English', () => {
    const range1 = { ...baseRange, added: 1, removed: 1 };
    expect(TEXTS.en.rangeBranch(range1)).toContain('1 line added and 1 removed.');
    expect(TEXTS.en.rangeUnpushed(range1)).toContain('1 line added and 1 removed.');
    expect(TEXTS.en.rangeSinceRun(range1)).toContain('1 line added and 1 removed.');
    expect(TEXTS.en.rangeSinceRef(range1)).toContain('1 line added and 1 removed.');

    const range7 = { ...baseRange, added: 7, removed: 2 };
    expect(TEXTS.en.rangeBranch(range7)).toContain('7 lines added and 2 removed.');
    expect(TEXTS.en.rangeUnpushed(range7)).toContain('7 lines added and 2 removed.');
    expect(TEXTS.en.rangeSinceRun(range7)).toContain('7 lines added and 2 removed.');
    expect(TEXTS.en.rangeSinceRef(range7)).toContain('7 lines added and 2 removed.');
  });

  it('formats rangeBranch in English with "split from"', () => {
    const params = { ...baseRange, added: 7, removed: 2 };
    expect(TEXTS.en.rangeBranch(params)).toBe(
      'Reviewed from where the branch split from origin/main (a1b2c3d) to 9f8e7d6: 2 commits, 3 files, 7 lines added and 2 removed.',
    );
  });

  it('formats rangeUnpushed with exact text without double colons in both languages', () => {
    const params = { ...baseRange, added: 15, removed: 4 };
    expect(TEXTS.es.rangeUnpushed(params)).toBe(
      'Revisado lo que no se ha subido de la rama feat/checkout, desde origin/main (a1b2c3d) hasta 9f8e7d6: 2 commits, 3 archivos, 15 líneas agregadas y 4 quitadas.',
    );
    expect(TEXTS.en.rangeUnpushed(params)).toBe(
      'Reviewed the unpushed work on branch feat/checkout, from origin/main (a1b2c3d) to 9f8e7d6: 2 commits, 3 files, 15 lines added and 4 removed.',
    );
  });
});

describe('fileProblems', () => {
  it('returns exact strings for empty list, single problem, and multiple problems in Spanish', () => {
    expect(TEXTS.es.fileProblems([])).toBe('sin problemas');
    expect(TEXTS.es.fileProblems([2])).toBe('problema 2');
    expect(TEXTS.es.fileProblems([1, 5, 7])).toBe('problemas 1, 5 y 7');
  });

  it('returns exact strings for empty list, single problem, and multiple problems in English', () => {
    expect(TEXTS.en.fileProblems([])).toBe('no issues');
    expect(TEXTS.en.fileProblems([2])).toBe('issue 2');
    expect(TEXTS.en.fileProblems([1, 5, 7])).toBe('issues 1, 5 and 7');
  });
});
