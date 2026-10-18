import { parse as parseYaml, YAMLParseError } from 'yaml';

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrontmatterError';
  }
}

export function parseFrontmatter(text: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const isDelimiter = (line: string): boolean => /^---[ \t]*$/.test(line);

  if (!isDelimiter(lines[0])) {
    throw new FrontmatterError('Frontmatter opening delimiter --- is missing');
  }

  const closingLine = lines.findIndex((line, index) => index > 0 && isDelimiter(line));
  if (closingLine === -1) {
    throw new FrontmatterError('Frontmatter closing delimiter --- is missing');
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(lines.slice(1, closingLine).join('\n'), { logLevel: 'error' });
  } catch (error) {
    const yamlLine = error instanceof YAMLParseError ? error.linePos?.[0]?.line : undefined;
    const fileLine = yamlLine === undefined ? undefined : yamlLine + 1;
    const rawDetail = error instanceof Error ? error.message : String(error);
    const detail = rawDetail.replace(/\s+at line \d+[\s\S]*$/i, '');
    const location = fileLine === undefined ? '' : ` at line ${fileLine}`;
    throw new FrontmatterError(`Invalid YAML${location}: ${detail}`);
  }

  if (parsed === null || parsed === undefined) {
    parsed = {};
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FrontmatterError('Frontmatter YAML must be a mapping');
  }

  return {
    data: parsed as Record<string, unknown>,
    body: lines.slice(closingLine + 1).join('\n'),
  };
}
