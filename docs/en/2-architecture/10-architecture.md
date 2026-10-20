Part 2 · Page 3 of 26 · Previous: [Use code-audit today](../1-overview/20-usage.md) · Next: [Command line](20-cli.md) · [Index](../README.md)
# Architecture

Bun is the development toolkit: it installs dependencies, runs TypeScript tests and scripts, and bundles the CLI. Node.js runs the built JavaScript file, so running the CLI does not require Bun.

## Modules and connections

```mermaid
flowchart TD
    bin["src/bin.ts"] --> cli["src/cli.ts"]
    cli --> codes["src/exit-codes.ts"]
    cli --> version["src/version.ts"]
    cli --> init["src/init/init.ts"]
    cli --> check["src/check/check.ts"]
    init --> git["src/git/git.ts"]
    init --> templates["src/init/templates.ts"]
    check --> config["src/config/config.ts"]
    check --> rules["src/config/rules.ts"]
    check --> git["src/git/git.ts"]
    check --> match["src/config/match.ts"]
    match --> picomatch["picomatch"]
    range["src/review/range.ts"] --> git
    range --> match
    range --> reviewTypes["src/review/types.ts"]
    range --> configTypes["src/config/types.ts"]
    checkTest["src/check/check.test.ts"] --> check
    checkTest --> repoHelper["src/test-helpers/repo.ts"]
    matchTest["src/config/match.test.ts"] --> match
    rangeTest["src/review/range.test.ts"] --> range
    rangeTest --> repoHelper
    initTest["src/init/init.test.ts"] --> init
    initTest --> rules["src/config/rules.ts"]
    initTest --> task["src/config/task.ts"]
    pkg["package.json"] --> version
    configTest["config.test.ts"] --> config["config.ts"]
    rulesTest["rules.test.ts"] --> rules["rules.ts"]
    taskTest["task.test.ts"] --> task["task.ts"]
    config --> paths["paths.ts"]
    config --> types["types.ts"]
    config --> frontmatter["frontmatter.ts"]
    rules --> paths
    rules --> types
    rules --> frontmatter
    task --> types
    task --> frontmatter
    gitTest["git.test.ts"] --> git["src/git/git.ts"]
    gitTest --> repoHelper["src/test-helpers/repo.ts"]
    build["scripts/build.ts"] --> bin
    docsCheck["scripts/check-docs.ts"] --> docs["docs/en and docs/es"]
```

`src/bin.ts` passes the user's arguments to `main` in [`src/cli.ts`](../3-code/020-cli.md). The CLI imports [`src/exit-codes.ts`](../3-code/030-exit-codes-and-version.md), [`src/version.ts`](../3-code/030-exit-codes-and-version.md), [`src/init/init.ts`](../3-code/120-init-init.md), and [`src/check/check.ts`](../3-code/140-check-check.md). The version module reads `package.json`. The initializer imports [`src/git/git.ts`](../3-code/100-git-git.md), [`src/config/paths.ts`](../3-code/050-config-paths.md), and [`src/init/templates.ts`](../3-code/130-init-templates.md). The checker imports the configuration and rule loaders, the guarded Git runner, and the pattern matcher [`src/config/match.ts`](../3-code/150-config-match.md), which wraps `picomatch`.

[`src/review/range.ts`](../3-code/170-review-range.md) computes review scope by importing `src/git/git.ts`, `src/config/match.ts`, [`src/config/types.ts`](../3-code/060-config-types.md), and [`src/review/types.ts`](../3-code/160-review-types.md). Currently no command line command imports it yet.

[`src/config/frontmatter.ts`](../3-code/040-config-frontmatter.md) parses a YAML header and body. `src/config/rules.ts` and [`src/config/task.ts`](../3-code/090-config-task.md) import it; their tests import their respective loaders.

The build script bundles the executable from [`src/bin.ts`](../3-code/010-bin.md) into a JavaScript module. A JavaScript module (ESM) is a file that uses `import` and `export`. The documentation checker validates the English and Spanish pages.

The Git, initialization, and review range tests import `src/git/git.ts` and [`src/test-helpers/repo.ts`](../3-code/110-test-helpers-repo.md). `src/init/init.test.ts` also checks generated examples with the rule and task loaders. The test helper runs Git only in temporary fixture repositories. `src/config/match.test.ts` and `src/review/range.test.ts` test their respective modules directly.
Part 2 · Page 3 of 26 · Previous: [Use code-audit today](../1-overview/20-usage.md) · Next: [Command line](20-cli.md) · [Index](../README.md)

