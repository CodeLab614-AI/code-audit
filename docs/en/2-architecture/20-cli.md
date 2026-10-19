Part 2 · Page 4 of 20 · Previous: [Architecture](10-architecture.md) · Next: [Program entry point](../3-code/010-bin.md) · [Index](../README.md)
# Command line

The command line interface (CLI) reads the command and options supplied after the program name. Today, `--help` and `--version` succeed. The recognized commands `init`, `check`, and `review` each print that they are not available and return exit code `1`.

## Actual command results

These results were obtained from `node skills/code-audit/code-audit.mjs`:

| Invocation | Output | Code |
|---|---|---:|
| `--version` | `0.1.0` | 0 |
| `nope` | `Unknown command: nope` | 1 |
| `init --bogus` | `Unknown option: --bogus` | 1 |
| `init --root` | `Missing value for --root` | 1 |
| `init --language` | `Missing value for --language` | 1 |
| `init` | `init is not available yet` | 1 |
| `check` | `check is not available yet` | 1 |
| `review` | `review is not available yet` | 1 |

The `--root` and `--language` options consume the next argument, but these commands do not use those values. `--json` is accepted but does not change the placeholder output. Help is available by itself with `--help` or `-h`, or after a command.

## Help output

```text
code-audit 0.1.0

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
  --version           Show the version
```

## Exit codes

An exit code is the number a command returns to tell the shell whether it succeeded.

| Code | Meaning today | When used |
|---:|---|---|
| 0 | Success | Help or version output |
| 1 | Usage error | Unknown command/option, missing value, or unavailable command |
| 2 | Configuration invalid | Defined in `ExitCode`; no current command returns it |
| 3 | Not a repository | Defined in `ExitCode`; no current command returns it |
| 10 | Internal error | An unexpected error reaches `src/bin.ts` |
Part 2 · Page 4 of 20 · Previous: [Architecture](10-architecture.md) · Next: [Program entry point](../3-code/010-bin.md) · [Index](../README.md)
