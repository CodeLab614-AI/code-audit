import { describe, expect, test } from 'bun:test';
import { createMatcher } from './match.js';

describe('createMatcher', () => {
  test('matches files with dotfiles when using wildcards', () => {
    const matcher = createMatcher(['src/**']);
    expect(matcher('src/.env')).toBe('src/**');
    expect(matcher('src/index.ts')).toBe('src/**');
    expect(matcher('docs/readme.md')).toBeUndefined();
  });

  test('does not throw and never matches on an invalid pattern', () => {
    const matcher = createMatcher(['', '*.ts']);
    expect(matcher('test.ts')).toBe('*.ts');
    expect(matcher('test.js')).toBeUndefined();
  });

  test('returns the first matching pattern when multiple patterns match', () => {
    const matcher = createMatcher(['**/*.ts', 'src/*']);
    expect(matcher('src/app.ts')).toBe('**/*.ts');
  });

  test('returns undefined when no pattern matches or pattern list is empty', () => {
    const emptyMatcher = createMatcher([]);
    expect(emptyMatcher('file.txt')).toBeUndefined();

    const matcher = createMatcher(['*.js']);
    expect(matcher('file.txt')).toBeUndefined();
  });
});
