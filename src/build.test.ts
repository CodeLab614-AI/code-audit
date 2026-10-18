import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifact } from '../scripts/build.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('build artifact', () => {
  it('does not contain absolute local paths', async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'code-audit-build-'));
    try {
      const artifactPath = await buildArtifact(outputDirectory);
      const artifact = await readFile(artifactPath, 'utf8');

      expect(artifact).not.toContain(repoRoot);
      expect(artifact).not.toContain(homedir());
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
