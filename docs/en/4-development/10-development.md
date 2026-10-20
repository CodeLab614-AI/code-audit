Part 4 · Page 25 of 29 · Previous: [Repository snapshot](../3-code/200-review-snapshot.md) · Next: [Build script](15-build-script.md) · [Index](../README.md)
# Development

## Requirements and commands

Bun is the development runtime and package manager. TypeScript is checked with `tsc`, and the delivered `.mjs` targets Node.js. These results were observed in this repository.

| Command | Purpose | Actual result |
|---|---|---|
| `bun install` | Install dependencies | `Checked 9 installs across 10 packages (no changes) [6.00ms]` |
| `bun test` | Run tests | `121 pass`, `1 skip`, `0 fail`, `300 expect() calls` |
| `bun run typecheck` | Check TypeScript | `$ tsc --noEmit`, exit 0 |
| `bun run build` | Build standalone CLI | `$ bun scripts/build.ts`, exit 0 |
| `bun run docs:check` | Check documentation and source comments | `Documentation check passed: 0 problems.` |

Tests live beside the files they cover, such as [src/cli.test.ts](../3-code/020-cli.md) and `src/config/frontmatter.test.ts`.

## Dependencies

`yaml` and `picomatch` are runtime dependencies bundled into the standalone `.mjs`; `@types/picomatch` is a development-only type package.

## Runtime boundary

Files in `src/` use Node modules prefixed with `node:`. Bun-specific APIs belong to development scripts and tests. `scripts/build.ts` uses `Bun.build`; the generated CLI runs in Node and prints `0.1.0` for `--version`.

## Branches and pull requests

Work on a feature branch, run the checks above, and open a pull request for review before integration. The repository owner creates commits and pushes the branch. Every code change updates its matching English and Spanish documentation in the same branch, so the code and its guide are reviewed together.
Part 4 · Page 25 of 29 · Previous: [Repository snapshot](../3-code/200-review-snapshot.md) · Next: [Build script](15-build-script.md) · [Index](../README.md)


