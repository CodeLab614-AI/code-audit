# Changelog

## Unreleased

- Fixed diff parsing in `readChangedLines` so text files containing the phrase "Binary files" retain their changes, restricting binary file detection to diff headers before hunk markers.
- Added changed lines reader (`readChangedLines`, `ChangedLines`) using unified diffs against the working tree and direct reads for untracked files.
- Added bilingual documentation for `src/review/changes.ts` and marked Plan 2 Task 2 complete.

- Fixed review range decision order on the base branch so commits made between reviews without upstream are reviewed using since-run mode when lastRunHead is provided, corrected the empty range error message in documentation, and restored the base branch --since documentation example.
- Fixed review range computation to use 3-dot diffs (`...`) in `unpushed`, `since-run`, and `since-ref` modes to avoid false deleted files from fetched upstream commits, allow reviewing uncommitted changes on the base branch without upstream, fail immediately when a configured `base_branch` does not exist in Git, and corrected `countFileLines` JSDoc.
- Added review range computation (`computeRange`, `resolveBase`), review types (`ChangedFile`, `ReviewRange`, `ReviewRangeErrorReason`, `ReviewRangeError`), and `createMatcher` pattern matcher.
- Added exit codes `REVIEW_RANGE: 4`, `REPO_CHANGED: 5`, and `FINDINGS_INVALID: 6`.
- Refactored `check` to use `createMatcher` for pattern matching without changing behavior.
- Added bilingual documentation for `range.ts`, `types.ts`, and `match.ts`, and marked Plan 2 Task 1 complete.
- Added the `check` command with rule ID, file-pattern, policy-count, and configuration diagnostics; bundled `picomatch` in the standalone CLI.
- Made unsupported integer structure versions a warning and clarified the missing-config recovery message.
- Added bilingual checker documentation and marked Plan 1 Task 7 complete.
- Preserved the written case of duplicate rule IDs in diagnostics, clarified missing severity and quoted structure-version errors, and refreshed compiled examples.


- Recognized the English task heading `Notes and decisions` and retained its notes in loaded tasks.
- Preserved validated `--language` values in generated config, selected Spanish for `es` variants, and rejected malformed values before writing.
- Fixed `.gitignore` updates when the existing file ends in a lone carriage return.
- Documented how to create task briefs in the generated project README.

- Added bilingual project initialization, safe file creation, normalized Git ignore entries, and CLI support for `init`.
- Added source pages and built CLI examples for initialization.
- Added a guarded read-only Git interface, isolated Git test repositories, and bilingual documentation for Task 5.
- Recognized `Notas` and trailing colons in task headings, and expanded task-loader examples.
- Added documentation checks for malformed and unclosed fenced code blocks.

- Recognized `Notas` and trailing colons in task headings, and expanded task-loader examples.
- Added documentation checks for malformed and unclosed fenced code blocks.

- Added task brief loading with YAML metadata, bilingual headings, numbered criteria validation, and diagnostics.
- Added bilingual documentation for the task loader and marked Plan 1 Task 4 complete.

- Added project configuration and recursive rule loaders with validation, normalized severities, and diagnostics.
- Added source pages for configuration paths, types, configuration loading, and rule loading in English and Spanish.
- Updated the documentation checker to accept nested section headings and validate type-only pages against the type template.

- Added the CLI skeleton with version, help, and placeholder commands.
- Added a build script that bundles the CLI into one standalone file.
- Added the YAML frontmatter reader.
- Added complete bilingual documentation and stricter checks for code-page sections, JSDoc, and repository-root discovery.
- Limited public documentation to built behavior, moved future work to the roadmap, and removed pages for unbuilt features.
- Added checks for page titles, navigation labels, and source-card status and refreshed documentation examples with actual output.
