import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

/** Creates and initializes an isolated Git repository for tests. */
export async function createRepo(prefix = 'code-audit-git-'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await execFile('git', ['-c', 'init.defaultBranch=main', 'init'], { cwd: root });
  await execFile('git', ['config', 'user.name', 'Code Audit Tests'], { cwd: root });
  await execFile('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: root });
  return root;
}

/** Writes a file, creating its parent folders inside a test repository. */
export async function writeRepoFile(root: string, file: string, content: string): Promise<void> {
  const path = join(root, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

/** Stages and commits all files in a test repository. */
export async function commitRepo(root: string, message = 'test commit'): Promise<void> {
  await execFile('git', ['add', '--all'], { cwd: root });
  await execFile('git', ['commit', '-m', message], { cwd: root });
}

/** Removes a temporary repository after a test. */
export async function removeRepo(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

/** Creates a bare repository for root-discovery tests. */
export async function createBareRepo(prefix = 'code-audit-bare-'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await execFile('git', ['init', '--bare'], { cwd: root });
  return root;
}
