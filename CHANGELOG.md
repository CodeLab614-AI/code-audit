# Changelog

## Unreleased

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
