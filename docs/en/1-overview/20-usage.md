Part 1 · Page 2 of 20 · Previous: [What is code-audit](10-what-is-code-audit.md) · Next: [Architecture](../2-architecture/10-architecture.md) · [Index](../README.md)
# Use code-audit today

## Requirements

Use Bun to install dependencies and build the command line program. Node.js runs the resulting `.mjs` file; Bun is not needed to run that artifact.

## Build and run

```sh
bun install
bun run build
node skills/code-audit/code-audit.mjs --help
node skills/code-audit/code-audit.mjs --version
```

The observed `bun install` output was:

```text
bun install v1.4.2 (744846f84)
Checked 7 installs across 8 packages (no changes) [4.00ms]
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
Part 1 · Page 2 of 20 · Previous: [What is code-audit](10-what-is-code-audit.md) · Next: [Architecture](../2-architecture/10-architecture.md) · [Index](../README.md)
