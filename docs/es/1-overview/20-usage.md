Parte 1 · Página 2 de 18 · Anterior: [Qué es code-audit](10-what-is-code-audit.md) · Siguiente: [Arquitectura](../2-architecture/10-architecture.md) · [Índice](../README.md)
# Uso de code-audit hoy

## Requisitos

Usa Bun para instalar dependencias y compilar el programa de línea de comandos. Node.js ejecuta el archivo `.mjs` resultante; Bun no hace falta para ejecutar ese artefacto.

## Compilar y ejecutar

```sh
bun install
bun run build
node skills/code-audit/code-audit.mjs --help
node skills/code-audit/code-audit.mjs --version
```

La salida observada de `bun install` fue:

```text
bun install v1.4.2 (744846f84)
Checked 7 installs across 8 packages (no changes) [4.00ms]
```

`bun run build` terminó con código `0` y mostró:

```text
$ bun scripts/build.ts
```

La salida de `--help` fue:

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

`node skills/code-audit/code-audit.mjs --version` mostró:

```text
// → 0.1.0
```
Parte 1 · Página 2 de 18 · Anterior: [Qué es code-audit](10-what-is-code-audit.md) · Siguiente: [Arquitectura](../2-architecture/10-architecture.md) · [Índice](../README.md)
