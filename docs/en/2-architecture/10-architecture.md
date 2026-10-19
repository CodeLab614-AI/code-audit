Part 2 · Page 3 of 17 · Previous: [Use code-audit today](../1-overview/20-usage.md) · Next: [Command line](20-cli.md) · [Index](../README.md)
# Architecture

Bun is the development toolkit: it installs dependencies, runs TypeScript tests and scripts, and bundles the CLI. Node.js runs the built JavaScript file, so running the CLI does not require Bun.

## Modules and connections

```mermaid
flowchart TD
    bin["src/bin.ts"] --> cli["src/cli.ts"]
    cli --> codes["src/exit-codes.ts"]
    cli --> version["src/version.ts"]
    pkg["package.json"] --> version
    configTest["config.test.ts"] --> config["config.ts"]
    rulesTest["rules.test.ts"] --> rules["rules.ts"]
    config --> paths["paths.ts"]
    config --> types["types.ts"]
    config --> frontmatter["frontmatter.ts"]
    rules --> paths
    rules --> types
    rules --> frontmatter
    build["scripts/build.ts"] --> bin
    docsCheck["scripts/check-docs.ts"] --> docs["docs/en and docs/es"]
```

`src/bin.ts` passes the user's arguments to `main` in [`src/cli.ts`](../3-code/020-cli.md). The CLI imports [`src/exit-codes.ts`](../3-code/030-exit-codes-and-version.md) and [`src/version.ts`](../3-code/030-exit-codes-and-version.md). The version module reads `package.json`.

[`src/config/frontmatter.ts`](../3-code/040-config-frontmatter.md) parses a YAML header and body. No production file imports it today; only its test file imports it.

The build script bundles the executable from [`src/bin.ts`](../3-code/010-bin.md) into a JavaScript module. A JavaScript module (ESM) is a file that uses `import` and `export`. The documentation checker validates the English and Spanish pages.
Part 2 · Page 3 of 17 · Previous: [Use code-audit today](../1-overview/20-usage.md) · Next: [Command line](20-cli.md) · [Index](../README.md)
