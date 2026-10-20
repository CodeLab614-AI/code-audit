import { describe, expect, test } from 'bun:test';
import type { Rule } from '../config/types.js';
import type { Task } from '../config/task.js';
import type { ChangedFile } from './types.js';
import type { ChangedLines } from './changes.js';
import {
  normalizeForKeywords,
  selectRules,
} from './select.js';

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: overrides.id ?? 'RULE-001',
    title: overrides.title ?? 'Test Rule',
    severity: overrides.severity ?? 'major',
    appliesTo: overrides.appliesTo ?? [],
    keywords: overrides.keywords ?? [],
    kind: overrides.kind ?? 'rule',
    file: overrides.file ?? 'rules/test.md',
    body: overrides.body ?? 'Rule body content',
  };
}

function makeChangedFile(path: string, overrides: Partial<ChangedFile> = {}): ChangedFile {
  return {
    path,
    status: overrides.status ?? 'modified',
    added: overrides.added ?? 1,
    removed: overrides.removed ?? 0,
    binary: overrides.binary ?? false,
    committed: overrides.committed ?? true,
    uncommitted: overrides.uncommitted ?? false,
    ...overrides,
  };
}

function makeChangedLines(path: string, addedTexts: string[] = [], removedTexts: string[] = []): ChangedLines {
  return {
    path,
    added: addedTexts.map((text, idx) => ({ line: idx + 1, text })),
    removed: removedTexts,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    file: 'tasks/PAY-123.md',
    objective: overrides.objective ?? 'Implement payment processing',
    criteria: overrides.criteria ?? ['Criterion 1: works correctly'],
    ...overrides,
  };
}

describe('selectRules', () => {
  // 1. Patrones
  test('patrones: una regla con src/billing/** entra si cambió src/billing/total.ts y queda fuera si solo cambió docs/x.md', () => {
    const rule = makeRule({
      id: 'BIZ-001',
      kind: 'business',
      appliesTo: ['src/billing/**'],
    });

    const matchingFiles = [makeChangedFile('src/billing/total.ts')];
    const nonMatchingFiles = [makeChangedFile('docs/x.md')];

    const resultMatch = selectRules([rule], matchingFiles, []);
    expect(resultMatch.selected).toHaveLength(1);
    expect(resultMatch.selected[0].rule.id).toBe('BIZ-001');
    expect(resultMatch.selected[0].reasons).toEqual([
      { type: 'applies_to', pattern: 'src/billing/**', files: ['src/billing/total.ts'] },
    ]);

    const resultNoMatch = selectRules([rule], nonMatchingFiles, []);
    expect(resultNoMatch.selected).toHaveLength(0);
  });

  // 2. Políticas
  test('políticas: una política entra sin cambios relacionados', () => {
    const policy = makeRule({
      id: 'POL-001',
      kind: 'policy',
      appliesTo: [],
    });

    const result = selectRules([policy], [], []);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].rule.id).toBe('POL-001');
    expect(result.selected[0].reasons).toEqual([{ type: 'policy' }]);
  });

  // 3. Acentos
  test('acentos: la palabra clave IVA entra con la línea agregada const iva = 16; precio entra con Precio y con précio', () => {
    const ruleIva = makeRule({
      id: 'RULE-IVA',
      keywords: ['IVA'],
    });
    const rulePrecio = makeRule({
      id: 'RULE-PRECIO',
      keywords: ['precio'],
    });

    const linesIva = [makeChangedLines('src/calc.ts', ['const iva = 16;'])];
    const resIva = selectRules([ruleIva], [makeChangedFile('src/calc.ts')], linesIva);
    expect(resIva.selected).toHaveLength(1);
    expect(resIva.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'IVA', where: 'changes' },
    ]);

    const linesPrecio1 = [makeChangedLines('src/calc.ts', ['const Precio = 100;'])];
    const resPrecio1 = selectRules([rulePrecio], [makeChangedFile('src/calc.ts')], linesPrecio1);
    expect(resPrecio1.selected).toHaveLength(1);
    expect(resPrecio1.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'precio', where: 'changes' },
    ]);

    const linesPrecio2 = [makeChangedLines('src/calc.ts', ['calcula el précio total'])];
    const resPrecio2 = selectRules([rulePrecio], [makeChangedFile('src/calc.ts')], linesPrecio2);
    expect(resPrecio2.selected).toHaveLength(1);
    expect(resPrecio2.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'precio', where: 'changes' },
    ]);
  });

  // 4. Palabra completa
  test('palabra completa: la palabra clave iva no entra con derivada', () => {
    const rule = makeRule({
      id: 'RULE-IVA',
      keywords: ['iva'],
    });
    const lines = [makeChangedLines('src/math.ts', ['funcion derivada(x)'])];

    const result = selectRules([rule], [makeChangedFile('src/math.ts')], lines);
    expect(result.selected).toHaveLength(0);
  });

  // 5. Varias palabras
  test('varias palabras: la palabra clave forma de pago entra con forma  de pago', () => {
    const rule = makeRule({
      id: 'RULE-PAY',
      keywords: ['forma de pago'],
    });
    const lines = [makeChangedLines('src/checkout.ts', ['const forma  de pago = "tarjeta";'])];

    const result = selectRules([rule], [makeChangedFile('src/checkout.ts')], lines);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'forma de pago', where: 'changes' },
    ]);
  });

  // 6. Ficha
  test('ficha: una palabra clave que solo está en la ficha entra con where: "task"', () => {
    const rule = makeRule({
      id: 'RULE-REFUND',
      keywords: ['reembolso'],
    });
    const task = makeTask({
      objective: 'Gestionar proceso de reembolso al cliente',
      criteria: ['1. El reembolso se ejecuta en 24 horas'],
    });

    const result = selectRules([rule], [], [], task);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'reembolso', where: 'task' },
    ]);
  });

  // 7. Renombrado
  test('renombrado: si src/billing/a.ts pasó a lib/a.ts, la regla con src/billing/** entra', () => {
    const rule = makeRule({
      id: 'RULE-BILLING',
      appliesTo: ['src/billing/**'],
    });
    const file = makeChangedFile('lib/a.ts', {
      oldPath: 'src/billing/a.ts',
      status: 'renamed',
    });

    const result = selectRules([rule], [file], []);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([
      { type: 'applies_to', pattern: 'src/billing/**', files: ['lib/a.ts'] },
    ]);
  });

  // 8. Total
  test('total es el número de reglas cargadas', () => {
    const r1 = makeRule({ id: 'R-1', appliesTo: ['src/**'] });
    const r2 = makeRule({ id: 'R-2', appliesTo: ['test/**'] });
    const r3 = makeRule({ id: 'R-3', kind: 'policy' });

    const result = selectRules([r1, r2, r3], [makeChangedFile('src/index.ts')], []);
    expect(result.total).toBe(3);
    expect(result.selected).toHaveLength(2); // r1 and r3 match, r2 does not
  });

  // Varios motivos
  test('varios motivos: una regla que entra por patrón y por palabra clave aparece una sola vez, con los dos motivos en orden', () => {
    const rule = makeRule({
      id: 'RULE-MIX',
      appliesTo: ['src/**'],
      keywords: ['descuento'],
    });
    const files = [makeChangedFile('src/pricing.ts')];
    const lines = [makeChangedLines('src/pricing.ts', ['aplica descuento al total'])];

    const result = selectRules([rule], files, lines);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].rule.id).toBe('RULE-MIX');
    expect(result.selected[0].reasons).toEqual([
      { type: 'applies_to', pattern: 'src/**', files: ['src/pricing.ts'] },
      { type: 'keyword', keyword: 'descuento', where: 'changes' },
    ]);
  });

  // Varios patrones
  test('varios patrones que coinciden dan un motivo cada uno', () => {
    const rule = makeRule({
      id: 'RULE-MULTI-PATTERNS',
      appliesTo: ['src/api/**', 'src/**'],
    });
    const files = [makeChangedFile('src/api/users.ts')];

    const result = selectRules([rule], files, []);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([
      { type: 'applies_to', pattern: 'src/api/**', files: ['src/api/users.ts'] },
      { type: 'applies_to', pattern: 'src/**', files: ['src/api/users.ts'] },
    ]);
  });

  // El límite de 5
  test('el límite de 5: con 7 archivos que coinciden, el motivo lista los 5 primeros', () => {
    const rule = makeRule({
      id: 'RULE-LIMIT',
      appliesTo: ['src/**'],
    });
    const files = [
      makeChangedFile('src/f1.ts'),
      makeChangedFile('src/f2.ts'),
      makeChangedFile('src/f3.ts'),
      makeChangedFile('src/f4.ts'),
      makeChangedFile('src/f5.ts'),
      makeChangedFile('src/f6.ts'),
      makeChangedFile('src/f7.ts'),
    ];

    const result = selectRules([rule], files, []);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([
      {
        type: 'applies_to',
        pattern: 'src/**',
        files: ['src/f1.ts', 'src/f2.ts', 'src/f3.ts', 'src/f4.ts', 'src/f5.ts'],
      },
    ]);
  });

  // Caracteres especiales
  test('caracteres especiales: c++ y a.b', () => {
    const ruleCpp = makeRule({
      id: 'RULE-CPP',
      keywords: ['c++'],
    });
    const ruleDot = makeRule({
      id: 'RULE-DOT',
      keywords: ['a.b'],
    });

    const linesCpp = [makeChangedLines('src/main.ts', ['usa c++ aquí'])];
    const resCpp = selectRules([ruleCpp], [makeChangedFile('src/main.ts')], linesCpp);
    expect(resCpp.selected).toHaveLength(1);
    expect(resCpp.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'c++', where: 'changes' },
    ]);

    const linesAxb = [makeChangedLines('src/main.ts', ['valor axb'])] ;
    const resAxb = selectRules([ruleDot], [makeChangedFile('src/main.ts')], linesAxb);
    expect(resAxb.selected).toHaveLength(0);

    const linesAb = [makeChangedLines('src/main.ts', ['valor a.b'])] ;
    const resAb = selectRules([ruleDot], [makeChangedFile('src/main.ts')], linesAb);
    expect(resAb.selected).toHaveLength(1);
    expect(resAb.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'a.b', where: 'changes' },
    ]);
  });

  // La misma palabra en los cambios y en la ficha
  test('la misma palabra en los cambios y en la ficha da dos motivos', () => {
    const rule = makeRule({
      id: 'RULE-TAX',
      keywords: ['impuesto'],
    });
    const lines = [makeChangedLines('src/tax.ts', ['calcula impuesto'])] ;
    const task = makeTask({
      objective: 'Calcular impuesto sobre ventas',
      criteria: ['1. Aplica tasa general'],
    });

    const result = selectRules([rule], [makeChangedFile('src/tax.ts')], lines, task);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'impuesto', where: 'changes' },
      { type: 'keyword', keyword: 'impuesto', where: 'task' },
    ]);
  });

  // nin no coincide con niño
  test('nin no coincide con niño', () => {
    const rule = makeRule({
      id: 'RULE-NIN',
      keywords: ['nin'],
    });
    const lines = [makeChangedLines('src/names.ts', ['el niño juega'])];

    const result = selectRules([rule], [makeChangedFile('src/names.ts')], lines);
    expect(result.selected).toHaveLength(0);
  });

  // Líneas quitadas
  test('líneas quitadas: una palabra que solo está en una línea quitada entra con where: "changes"', () => {
    const rule = makeRule({
      id: 'RULE-DEPRECATED',
      keywords: ['legacy_token'],
    });
    const lines = [makeChangedLines('src/auth.ts', [], ['delete legacy_token;'])];

    const result = selectRules([rule], [makeChangedFile('src/auth.ts')], lines);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([
      { type: 'keyword', keyword: 'legacy_token', where: 'changes' },
    ]);
  });

  // Otras secciones de la ficha
  test('otras secciones de la ficha: una palabra que solo está en las notas no entra', () => {
    const rule = makeRule({
      id: 'RULE-NOTE',
      keywords: ['secreto'],
    });
    const task = makeTask({
      objective: 'Crear endpoint público',
      criteria: ['1. Responde 200 OK'],
      notes: 'No compartir este secreto de implementación',
      outOfScope: 'No tocar secreto de autenticación',
      expectedAreas: 'secreto en api',
    });

    const result = selectRules([rule], [], [], task);
    expect(result.selected).toHaveLength(0);
  });

  // Orden final
  test('orden final: con reglas de los cinco tipos, desordenadas, salen en el orden de la precisión 5', () => {
    const rTemplateB = makeRule({ id: 'TMPL-002', kind: 'template', appliesTo: ['**'] });
    const rTemplateA = makeRule({ id: 'TMPL-001', kind: 'template', appliesTo: ['**'] });
    const rDecision = makeRule({ id: 'ADR-001', kind: 'decision', appliesTo: ['**'] });
    const rBusiness = makeRule({ id: 'BIZ-001', kind: 'business', appliesTo: ['**'] });
    const rRule = makeRule({ id: 'RULE-001', kind: 'rule', appliesTo: ['**'] });
    const rPolicyB = makeRule({ id: 'POL-002', kind: 'policy' });
    const rPolicyA = makeRule({ id: 'POL-001', kind: 'policy' });

    // Pass in random order
    const rules = [
      rTemplateB,
      rPolicyB,
      rBusiness,
      rDecision,
      rTemplateA,
      rRule,
      rPolicyA,
    ];

    const files = [makeChangedFile('src/anything.ts')];
    const result = selectRules(rules, files, []);

    expect(result.selected.map((s) => s.rule.id)).toEqual([
      'POL-001',
      'POL-002',
      'RULE-001',
      'BIZ-001',
      'ADR-001',
      'TMPL-001',
      'TMPL-002',
    ]);
  });

  // Políticas solo llevan motivo policy
  test('políticas: una política lleva solo motivo policy aunque tenga applies_to o keywords coincidentes', () => {
    const policy = makeRule({
      id: 'POL-STRICT',
      kind: 'policy',
      appliesTo: ['src/**'],
      keywords: ['password'],
    });
    const files = [makeChangedFile('src/auth.ts')];
    const lines = [makeChangedLines('src/auth.ts', ['check password'])] ;
    const task = makeTask({ objective: 'password security', criteria: ['1. password hash'] });

    const result = selectRules([policy], files, lines, task);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].reasons).toEqual([{ type: 'policy' }]);
  });

  // Palabra clave vacía al normalizar nunca coincide
  test('palabra clave vacía: una palabra clave vacía o con solo marcas al normalizarla nunca coincide', () => {
    const rule = makeRule({
      id: 'RULE-EMPTY',
      keywords: ['', '   ', '\u0300'],
    });
    const files = [makeChangedFile('src/empty.ts')];
    const lines = [makeChangedLines('src/empty.ts', ['any text here'])];

    const result = selectRules([rule], files, lines);
    expect(result.selected).toHaveLength(0);
  });
});

describe('normalizeForKeywords', () => {
  test('converts uppercase to lowercase and strips accents via NFD', () => {
    expect(normalizeForKeywords('PRÉCIO')).toBe('precio');
    expect(normalizeForKeywords('IVA')).toBe('iva');
    expect(normalizeForKeywords('niño')).toBe('nino');
    expect(normalizeForKeywords('ÁÉÍÓÚ')).toBe('aeiou');
  });

  test('preserves whitespace and punctuation unchanged', () => {
    expect(normalizeForKeywords('forma  de pago')).toBe('forma  de pago');
    expect(normalizeForKeywords('c++')).toBe('c++');
    expect(normalizeForKeywords('a.b')).toBe('a.b');
  });
});
