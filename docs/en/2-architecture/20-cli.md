Part 2 · Page 4 of 28 · Previous: [Architecture](10-architecture.md) · Next: [Program entry point](../3-code/010-bin.md) · [Index](../README.md)
# Command line

The command line interface (CLI) accepts `init`, `check`, and `review`, plus `--root`, `--language`, `--json`, `--help`, and `--version`. `check` validates the project and `review` still reports that it is not available.

## Current command results

| Invocation | Result | Code |
|---|---|---:|
| `--version` | `0.1.0` | 0 |
| `init --language fr` | Stores `fr` and generates English files | 0 |
| `init --language ES` | Stores `ES` and generates Spanish files | 0 |
| `init --language es-MX` | Stores `es-MX` and generates Spanish files | 0 |
| `init --language pt-BR` | Stores `pt-BR` and generates English files | 0 |
| `init --language "es\nx"` | `invalid language: es\nx`; writes no files | 1 |
| `init --language -es` | `invalid language: -es`; writes no files | 1 |
| `init --language "es: x"` | `invalid language: es: x` | 1 |
| `init` outside a Git repository | `not a working Git repository: <path>` | 3 |
| `check` with no errors | Summary with problem counts | 0 |
| `check` with warnings only | Warnings and summary | 0 |
| `check` with errors | Errors, warnings, and summary | 2 |
| `check --json` | Full JSON result with ordered problems | 0 or 2 |
| `check` outside a Git repository | `not a working Git repository: <path>` | 3 |
| `review` | `review is not available yet` | 1 |

The language value must contain letters and digits in nonempty groups separated by single hyphens. `init` saves the spelling as given; values equal to `es` or beginning with `es-`, without regard to case, select Spanish files. The default is `en`.

## Exit codes

| Code | Meaning | Current use |
|---:|---|---|
| 0 | Success | Help, version, or successful initialization |
| 1 | Usage error | Invalid arguments or language; unavailable `review` |
| 2 | Invalid configuration | `check` found one or more errors |
| 3 | Not a repository | `init` or `check` outside a working repository or without Git |
| 10 | Internal error | Unexpected initialization or check failure |

Part 2 · Page 4 of 28 · Previous: [Architecture](10-architecture.md) · Next: [Program entry point](../3-code/010-bin.md) · [Index](../README.md)


