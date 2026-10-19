Part 1 · Page 1 of 22 · Next: [Use code-audit today](20-usage.md) · [Index](../README.md)
# What is code-audit

## The problem

Artificial intelligence (AI) can now write a lot of code, so the bottleneck is often a person, usually the technical lead (the person who coordinates technical decisions), manually reviewing all of those changes. A branch is a separate line of work in the repository, the project folder that holds its code. Reviewing every change by hand takes time away from other work.

## The project's goal

The goal is for each project to write its own technical, business, and structure rules, then have code-audit compare a branch's changes with those rules so a person does not have to read every change. This review feature is the project's goal; it does not work yet.

## What exists today

- The [command-line program](../2-architecture/20-cli.md) supports `init`, `--help`, and `--version`. It creates bilingual project context, rule-folder examples, and a task template without replacing existing files.
- The [configuration readers](../3-code/070-config-config.md) and [rule and task readers](../3-code/080-config-rules.md) validate generated examples.
- The `check` and `review` commands still say they are not available yet.
- The [build script](../4-development/15-build-script.md) turns the source code, the instructions written by developers, into a program file that can be run.
- The [documentation checker](../4-development/17-docs-check.md) checks the project's public guides.

## What is missing

The review feature described above is not implemented yet; the [roadmap](../4-development/30-roadmap.md) lists the work that remains.
Part 1 · Page 1 of 22 · Next: [Use code-audit today](20-usage.md) · [Index](../README.md)
