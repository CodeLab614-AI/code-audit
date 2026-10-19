import { ExitCode } from './exit-codes.js';
import { findRepoRoot, GitError, NotARepoError } from './git/git.js';
import { initProject, InvalidLanguageError } from './init/init.js';
import { checkProject } from './check/check.js';
import { VERSION } from './version.js';

/** Supplies output functions used by the CLI. */
export interface CliIO {
  stdout(s: string): void;
  stderr(s: string): void;
}

const HELP = `code-audit ${VERSION}

Usage: code-audit <command> [options]

Commands:
  init    Create the project configuration
  check   Validate the project configuration
  review  Review the current branch

Options:
  --root <path>       Project root directory
  --language <code>   Language for generated files
  --json              Print machine-readable output
  --help              Show this help
  --version           Show the version`;

const COMMANDS = new Set(['init', 'check', 'review']);

/** Runs the CLI command and returns its process exit code. */
export async function main(argv: string[], io: CliIO = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
}): Promise<number> {
  if (argv.length === 1 && argv[0] === '--version') {
    io.stdout(`${VERSION}\n`);
    return ExitCode.OK;
  }

  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    io.stdout(`${HELP}\n`);
    return ExitCode.OK;
  }

  const [command, ...options] = argv;
  if (!command || command.startsWith('-') || !COMMANDS.has(command)) {
    io.stderr(`Unknown command: ${command ?? ''}\n`);
    return ExitCode.USAGE;
  }

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === '--json') continue;
    if (option === '--root' || option === '--language') {
      if (!options[index + 1] || options[index + 1].startsWith('--')) {
        io.stderr(`Missing value for ${option}\n`);
        return ExitCode.USAGE;
      }
      index += 1;
      continue;
    }
    if (option === '--help' || option === '-h') {
      io.stdout(`${HELP}\n`);
      return ExitCode.OK;
    }
    io.stderr(`Unknown option: ${option}\n`);
    return ExitCode.USAGE;
  }

  if (command === 'init') {
    let root = process.cwd();
    let language = 'en';
    let json = false;
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      if (option === '--json') json = true;
      else if (option === '--root') root = options[++index]!;
      else if (option === '--language') language = options[++index]!;
    }
    try {
      const result = await initProject(root, { language });
      io.stdout(json ? `${JSON.stringify(result)}\n` : formatInitResult(result));
      return ExitCode.OK;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof InvalidLanguageError) {
        io.stderr(`${message}\n`);
        return ExitCode.USAGE;
      }
      if (error instanceof NotARepoError) {
        io.stderr(`${message}\n`);
        return ExitCode.NOT_A_REPO;
      }
      io.stderr(`init failed: ${message}\n`);
      return ExitCode.INTERNAL;
    }
  }

  if (command === 'review') {
    io.stderr('review is not available yet\n');
    return ExitCode.USAGE;
  }

  if (command === 'check') {
    let root = process.cwd();
    let json = false;
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      if (option === '--json') json = true;
      else if (option === '--root') root = options[++index]!;
      else if (option === '--language') index += 1;
    }
    try {
      const repoRoot = await findRepoRoot(root);
      const result = await checkProject(repoRoot);
      if (json) io.stdout(`${JSON.stringify(result)}\n`);
      else io.stdout(formatCheckResult(result));
      return result.problems.some((problem) => problem.level === 'error') ? ExitCode.CONFIG_INVALID : ExitCode.OK;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof NotARepoError || (error instanceof GitError && ['git-unavailable', 'directory'].includes(error.reason))) {
        io.stderr(`${message}\n`);
        return ExitCode.NOT_A_REPO;
      }
      io.stderr(`check failed: ${message}\n`);
      return ExitCode.INTERNAL;
    }
  }

  io.stderr(`${command} is not available yet\n`);
  return ExitCode.USAGE;
}

/** Formats a successful initialization for terminal output. */
function formatInitResult(result: { created: string[]; skipped: string[]; gitignoreUpdated: boolean }): string {
  const lines = [`Created ${result.created.length} file(s).`, `Skipped ${result.skipped.length} existing file(s).`];
  if (result.gitignoreUpdated) lines.push('Updated .gitignore.');
  else lines.push('.gitignore already contains the required entries.');
  return `${lines.join('\n')}\n`;
}

/** Formats validation problems and their summary for terminal output. */
function formatCheckResult(result: { problems: Array<{ level: 'error' | 'warning'; file: string; message: string }>; ruleCount: number; policyCount: number }): string {
  const errors = result.problems.filter((problem) => problem.level === 'error');
  const warnings = result.problems.filter((problem) => problem.level === 'warning');
  const lines = result.problems.map((problem) => `${problem.level.padEnd(7)} ${problem.file}: ${problem.message}`);
  lines.push(`${result.ruleCount} ${result.ruleCount === 1 ? 'rule' : 'rules'} (${result.policyCount} ${result.policyCount === 1 ? 'policy' : 'policies'}). ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}, ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}.`);
  return `${lines.join('\n')}\n`;
}
