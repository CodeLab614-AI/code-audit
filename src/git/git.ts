import { execFile as execFileCallback } from 'node:child_process';
import { stat } from 'node:fs/promises';

/** Lists Git subcommands that this module permits. */
export const READ_ONLY_COMMANDS = [
  'diff', 'log', 'show', 'status', 'rev-parse', 'merge-base', 'ls-files', 'cat-file', 'grep', 'blame',
] as const;

const MAX_BUFFER = 256 * 1024 * 1024;
const DANGEROUS_LONG_OPTIONS = [
  'output', 'open-files-in-pager', 'ext-diff', 'textconv', 'exec-path', 'git-dir', 'work-tree', 'filters',
];

/** Reports a request to run a command or option outside the read-only policy. */
export class GitForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitForbiddenError';
  }
}

/** Reports Git failures and keeps the process exit code and standard error. */
export class GitError extends Error {
  exitCode: number | null;
  stderr: string;
  reason: 'git-unavailable' | 'directory' | 'output-limit' | 'git-failed';

  constructor(
    message: string,
    exitCode: number | null,
    stderr: string,
    reason: 'git-unavailable' | 'directory' | 'output-limit' | 'git-failed' = 'git-failed',
  ) {
    super(message);
    this.name = 'GitError';
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.reason = reason;
  }
}

/** Reports that a path is not inside a non-bare working repository. */
export class NotARepoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotARepoError';
  }
}

/** Runs an allowlisted Git command; maxBuffer is exposed for focused tests. */
export async function runGit(
  root: string,
  args: string[],
  options: { maxBuffer?: number } = {},
): Promise<string> {
  validateArguments(args);
  await requireDirectory(root);
  const command = args[0]!;
  const commandArgs = args.slice(1);
  const safetyArgs = command === 'diff' || command === 'log' || command === 'show'
    ? ['--no-ext-diff', '--no-textconv']
    : command === 'blame' ? ['--no-textconv'] : [];
  const env = safeEnvironment();

  try {
    const result = await executeGit([
      '--no-pager', '-c', 'core.quotePath=false', '-c', 'color.ui=false', command,
      ...safetyArgs, ...commandArgs,
    ], root, env, options.maxBuffer ?? MAX_BUFFER);
    return result.stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    if (failure.code === 'ENOENT') {
      if (!(await isDirectory(root))) throw directoryError(root);
      throw new GitError('git is not installed or not in PATH', null, failure.stderr ?? '', 'git-unavailable');
    }
    const stderr = failure.stderr ?? '';
    if (command === 'grep' && Number(failure.code) === 1 && stderr.length === 0) return '';
    if (failure.code === 'ENOBUFS' || failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      const limit = options.maxBuffer ?? MAX_BUFFER;
      const size = limit === MAX_BUFFER ? '256 MiB' : `${limit} bytes`;
      throw new GitError(`git output exceeded ${size}`, null, stderr, 'output-limit');
    }
    const exitCode = typeof failure.code === 'number' ? failure.code : null;
    const detail = stderr.trim();
    throw new GitError(detail || `git ${command} failed`, exitCode, stderr);
  }
}

/** Resolves the non-bare repository root containing the supplied path. */
export async function findRepoRoot(cwd: string): Promise<string> {
  try {
    const root = (await runGit(cwd, ['rev-parse', '--show-toplevel'])).replace(/\r?\n$/, '');
    const bare = (await runGit(cwd, ['rev-parse', '--is-bare-repository'])).trim();
    if (bare === 'true') throw new NotARepoError(`not a working Git repository: ${cwd}`);
    return root;
  } catch (error) {
    if (error instanceof NotARepoError) throw error;
    if (error instanceof GitError && error.reason === 'git-unavailable') {
      throw new NotARepoError('Git is not installed or not in PATH');
    }
    if (error instanceof GitError && error.reason === 'directory') throw new NotARepoError(error.message);
    throw new NotARepoError(`not a working Git repository: ${cwd}`);
  }
}

/** Rejects subcommands and dangerous options before starting a child process. */
function validateArguments(args: string[]): void {
  const command = args[0];
  if (!command || command.startsWith('-') || !(READ_ONLY_COMMANDS as readonly string[]).includes(command)) {
    throw new GitForbiddenError(`Git subcommand is not allowed: ${command ?? '(missing)'}`);
  }

  for (const argument of args.slice(1)) {
    if (isForbiddenArgument(command, argument)) {
      throw new GitForbiddenError(`Git option is not allowed for ${command}: ${argument}`);
    }
  }
}

/** Detects full options, their abbreviations, and dangerous short-option groups. */
function isForbiddenArgument(command: string, argument: string): boolean {
  if (argument.startsWith('--')) {
    const name = argument.slice(2).split('=', 1)[0]!;
    if (!name) return false;
    if (name.startsWith('output-indicator-')) return false;
    return DANGEROUS_LONG_OPTIONS.some((option) => option.startsWith(name));
  }

  if (!argument.startsWith('-') || argument.startsWith('--')) return false;
  if (argument === '-c' || argument.startsWith('-c')) return true;
  if (['diff', 'log', 'show'].includes(command) && argument.includes('o')) return true;
  if (command === 'grep' && argument.includes('O')) return true;
  return false;
}

/** Copies the process environment without inherited Git repository overrides. */
function safeEnvironment(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  return {
    ...env,
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
    GIT_TERMINAL_PROMPT: '0',
  };
}

/** Verifies that a working directory exists before spawning Git. */
async function requireDirectory(path: string): Promise<void> {
  if (!(await isDirectory(path))) throw directoryError(path);
}

/** Checks whether a path exists and is a directory. */
async function isDirectory(path: string): Promise<boolean> {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

/** Creates a GitError with the shared missing-directory message. */
function directoryError(path: string): GitError {
  return new GitError(`directory does not exist: ${path}`, null, '', 'directory');
}

/** Executes Git and closes its unused standard input immediately. */
function executeGit(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  maxBuffer: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFileCallback('git', args, { cwd, env, encoding: 'utf8', maxBuffer }, (error, stdout, stderr) => {
      if (error) {
        const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
        failure.stdout = stdout;
        failure.stderr = stderr;
        reject(failure);
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.stdin?.end();
  });
}
