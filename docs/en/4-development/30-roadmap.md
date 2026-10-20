Part 4 · Page 32 of 32 · Previous: [Documentation standard](20-documentation-standard.md) · (last) · [Index](../README.md)
# Roadmap

- **Task 1 — Done:** Bun project setup, CLI skeleton, and single-file build.
- **Task 2 — Done:** YAML frontmatter reader with validation.
- **Task 3 — Done:** Load and validate project configuration and rule files.
- **Task 4 — Done:** Load and validate a Markdown task brief.
- **Task 5 — Done:** Run Git commands through a read-only, guarded interface.
- **Task 6 — Done:** Create bilingual project configuration without replacing existing files and connect `init` to the CLI.
- **Task 7 — Done:** Validate configuration, duplicate rule IDs, and file patterns, then connect `check` to the CLI. Plan 1 is complete.

## Plan 2: Review without AI

- **Task 1 — Done:** Review range computation (`computeRange`, `resolveBase`, review types, and `createMatcher` pattern matcher).
- **Task 2 — Done:** Changed lines (`readChangedLines` and `ChangedLines` via unified diff against the working tree and reading untracked files).
- **Task 3 — Done:** Rule selection (`selectRules`, `SelectedRule`, `SelectionReason`, and `normalizeForKeywords` for policies, patterns with renames, and whole-word / accent-insensitive keywords).
- **Task 4 — Done:** Repository snapshot (`takeSnapshot`, `compareSnapshots`, `Snapshot`, and `SnapshotChange` to record and compare Git state, staging index, and non-ignored files).
- **Task 5 — Done:** Schema and validation for `findings.json` (`validateFindings`, `FindingsInvalidError`, `FINDINGS_SCHEMA_VERSION`, normalized types, and exact discards with quote and path verification).
- **Planned:** Report model, fixed texts, and HTML and Markdown report generation.

## Plan 3: Code map

**Planned:** Use tree-sitter grammars to map imports, dependents, components, and utilities in the project.

## Plan 4: Sessions and skill

**Planned:** Open new review and verification sessions with the same agent that launches the skill; report when a change is large; provide the skill's `SKILL.md` instructions and tests.

See the [documentation checker page](17-docs-check.md) for its checks and examples.
Part 4 · Page 32 of 32 · Previous: [Documentation standard](20-documentation-standard.md) · (last) · [Index](../README.md)



