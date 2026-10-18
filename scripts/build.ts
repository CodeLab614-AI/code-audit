import { chmod, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Builds the standalone Node.js CLI artifact into the output directory. */
export async function buildArtifact(
  outputDirectory = resolve(root, 'skills/code-audit'),
): Promise<string> {
  const originalDirectory = process.cwd();
  const outdir = resolve(outputDirectory);
  const outfile = resolve(outdir, 'code-audit.mjs');

  await mkdir(dirname(outfile), { recursive: true });
  try {
    process.chdir(root);
    const result = await Bun.build({
      entrypoints: ['src/bin.ts'],
      target: 'node',
      format: 'esm',
      banner: '#!/usr/bin/env node',
      outdir,
      naming: { entry: 'code-audit.mjs' },
    });

    if (!result.success) {
      throw new AggregateError(result.logs, 'Failed to build code-audit');
    }

    await chmod(outfile, 0o755);
    return outfile;
  } finally {
    process.chdir(originalDirectory);
  }
}

if (import.meta.main) {
  await buildArtifact();
}
