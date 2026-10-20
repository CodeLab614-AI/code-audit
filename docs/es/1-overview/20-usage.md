Parte 1 · Página 2 de 26 · Anterior: [Qué es code-audit](10-what-is-code-audit.md) · Siguiente: [Arquitectura](../2-architecture/10-architecture.md) · [Índice](../README.md)
# Uso de code-audit hoy

## Requisitos

Usa Bun para instalar dependencias y compilar el programa de línea de comandos. Node.js ejecuta el archivo `.mjs` resultante; Bun no hace falta para ejecutar ese artefacto.

## Compilar y ejecutar

```sh
bun install
bun run build
node skills/code-audit/code-audit.mjs --help
node skills/code-audit/code-audit.mjs --version
node skills/code-audit/code-audit.mjs init --root /path/to/project --language es
node skills/code-audit/code-audit.mjs check --root /path/to/project
```

La salida observada de `bun install` fue:

```text
bun install v1.4.2 (744846f84)
Checked 9 installs across 10 packages (no changes) [6.00ms]
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

## Inicializar un proyecto

Ejecuta `init` dentro de un repositorio Git o pasa con `--root` una ruta que esté dentro. `--language es` genera texto en español; el valor predeterminado y cualquier otro idioma generan inglés.

```text
$ node skills/code-audit/code-audit.mjs init --root /tmp/code-audit-t6-mzUNuI --language es
Created 12 file(s).
Skipped 0 existing file(s).
Updated .gitignore.
```

Agrega `--json` para recibir las rutas como JSON. En una segunda ejecución se conservan los archivos y se muestran como omitidos. La [página de arquitectura del CLI](../2-architecture/20-cli.md) enumera los códigos actuales; la [página del inicializador](../3-code/120-init-init.md) muestra el árbol resultante y la segunda salida.

Ejecuta `check` dentro de un repositorio Git o pasa con `--root` una ruta interna. Muestra cada error y aviso, y luego un resumen. Agrega `--json` para recibir el objeto completo. Devuelve 2 si hay errores, 0 si solo hay avisos o no hay problemas, y 3 fuera de un repositorio Git.
Parte 1 · Página 2 de 26 · Anterior: [Qué es code-audit](10-what-is-code-audit.md) · Siguiente: [Arquitectura](../2-architecture/10-architecture.md) · [Índice](../README.md)

