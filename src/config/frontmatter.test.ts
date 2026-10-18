import { describe, expect, it, spyOn } from 'bun:test';
import { FrontmatterError, parseFrontmatter } from './frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses YAML metadata and returns the body', () => {
    const result = parseFrontmatter('---\nid: BIZ-003\ntitle: Example\n---\nBody text\n');

    expect(result.data.id).toBe('BIZ-003');
    expect(result.data.title).toBe('Example');
    expect(result.body).toBe('Body text\n');
  });

  it('parses CRLF line endings', () => {
    const result = parseFrontmatter('---\r\nid: BIZ-003\r\n---\r\nBody\r\n');

    expect(result.data.id).toBe('BIZ-003');
    expect(result.body).toBe('Body\n');
  });

  it('ignores an initial UTF-8 BOM', () => {
    const result = parseFrontmatter('\uFEFF---\nid: BIZ-003\n---\nBody\n');

    expect(result.data.id).toBe('BIZ-003');
    expect(result.body).toBe('Body\n');
  });

  it('rejects text without a frontmatter delimiter', () => {
    expect(() => parseFrontmatter('id: BIZ-003\nBody\n')).toThrow(FrontmatterError);
  });

  it('includes a line number when the YAML is invalid', () => {
    try {
      parseFrontmatter('---\nid: BIZ-1\ntitle: : nope\n---\nBody\n');
      throw new Error('Expected invalid YAML to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(FrontmatterError);
      expect((error as Error).message).toContain('at line 3');
      expect((error as Error).message.match(/at line/gi)).toHaveLength(1);
    }
  });

  it('does not emit warnings from YAML parsing', () => {
    const emitWarning = spyOn(process, 'emitWarning');
    try {
      parseFrontmatter('---\nx: !!js/function "f"\n---\nBody\n');
      expect(emitWarning).not.toHaveBeenCalled();
    } finally {
      emitWarning.mockRestore();
    }
  });

  it('accepts delimiters followed by spaces or tabs', () => {
    const result = parseFrontmatter('--- \t\nid: BIZ-003\n--- \t\nBody\n');

    expect(result.data.id).toBe('BIZ-003');
    expect(result.body).toBe('Body\n');
  });

  it('rejects an unclosed frontmatter block', () => {
    expect(() => parseFrontmatter('---\nid: BIZ-003\nBody\n')).toThrow(/closing delimiter/i);
  });

  it('rejects YAML that is not a mapping', () => {
    expect(() => parseFrontmatter('---\n- item\n---\nBody\n')).toThrow(/must be a mapping/i);
  });

  it('returns an empty mapping for an empty frontmatter block', () => {
    expect(parseFrontmatter('---\n\n---\nBody\n').data).toEqual({});
  });
});
