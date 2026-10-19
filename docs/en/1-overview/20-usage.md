Part 1 · Page 2 of 23 · Previous: [What is code-audit](10-what-is-code-audit.md) · Next: [Architecture](../2-architecture/10-architecture.md) · [Index](../README.md)
# Use code-audit today

## Requirements

Use Bun to install dependencies and build the command line program. Node.js runs the resulting `.mjs` file; Bun is not needed to run that artifact.

## Build and run

```sh
bun install
bun run build
node skills/code-audit/code-audit.mjs --help
node skills/code-audit/code-audit.mjs --version
node skills/code-audit/code-audit.mjs init --root /path/to/project --language es
node skills/code-audit/code-audit.mjs check --root /path/to/project
```

The observed `bun install` output was:

```text
bun install v1.4.2 (744846f84)
Checked 9 installs across 10 packages (no changes) [6.00ms]
```

`bun run build` completed with exit code `0` and printed:

```text
$ bun scripts/build.ts
```

The built program's `--help` output was:

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

Running `node skills/code-audit/code-audit.mjs --version` printed:

```text
// → 0.1.0
```

## Initialize a project

Run `init` from inside a Git repository or pass a path inside it with `--root`. The generated text is Spanish with `--language es`; the default and all other language values use English.

```text
$ node skills/code-audit/code-audit.mjs init --root /tmp/code-audit-t6-mzUNuI --language es
Created 12 file(s).
Skipped 0 existing file(s).
Updated .gitignore.
```

To capture the paths as JSON, add `--json`. Running `init` again preserves the files and lists them as skipped. The [CLI architecture page](../2-architecture/20-cli.md) lists the current exit codes; the [initializer page](../3-code/120-init-init.md) shows the resulting tree and second-run output.

Run `check` inside a Git repository or pass a path within it with `--root`. It prints each error and warning, then a count summary. Add `--json` for the complete result object. It returns 2 for errors, 0 for warnings only or no problems, and 3 outside a Git repository.
Part 1 · Page 2 of 23 · Previous: [What is code-audit](10-what-is-code-audit.md) · Next: [Architecture](../2-architecture/10-architecture.md) · [Index](../README.md)
