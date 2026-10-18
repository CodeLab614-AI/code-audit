import { chmod, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, 'skills/code-audit/code-audit.mjs');
await mkdir(dirname(outfile), { recursive: true });

const result = await Bun.build({
  entrypoints: ['src/bin.ts'],
  target: 'node',
  format: 'esm',
  banner: '#!/usr/bin/env node',
  outdir: 'skills/code-audit',
  naming: { entry: 'code-audit.mjs' },
});

if (!result.success) {
  throw new AggregateError(result.logs, 'Failed to build code-audit');
}

await chmod(outfile, 0o755);
