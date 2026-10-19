Parte 4 · Página 18 de 22 · Anterior: [Plantillas de inicialización](../3-code/130-init-templates.md) · Siguiente: [Script de compilación](15-build-script.md) · [Índice](../README.md)
# Desarrollo

## Requisitos y comandos

Bun es el entorno de desarrollo y el gestor de paquetes. TypeScript añade tipos a JavaScript; `tsc` es su compilador y comprueba esos tipos. El archivo `.mjs` compilado se ejecuta en Node.js. Estos resultados se observaron en este repositorio.

| Comando | Propósito | Resultado real |
|---|---|---|
| `bun install` | Instalar dependencias | `Checked 7 installs across 8 packages (no changes) [4.00ms]` |
| `bun test` | Ejecutar pruebas | `32 pass`, `0 fail`, `59 expect() calls` |
| `bun run typecheck` | Comprobar TypeScript | `$ tsc --noEmit`, código 0 |
| `bun run build` | Compilar el CLI independiente | `$ bun scripts/build.ts`, código 0 |
| `bun run docs:check` | Comprobar docs y comentarios | `Documentation check passed: 0 problems.` |

Las pruebas viven junto al archivo que cubren, como [src/cli.test.ts](../3-code/020-cli.md) y `src/config/frontmatter.test.ts`.

## Límite del entorno de ejecución

Los archivos de `src/` usan módulos de Node con prefijo `node:`. Las interfaces de programación (API) de Bun se limitan a scripts y pruebas de desarrollo. `scripts/build.ts` usa `Bun.build`; el CLI generado corre en Node y `--version` imprime `0.1.0`.

## Ramas y solicitudes de integración

El trabajo se hace en una rama de funcionalidad; después de ejecutar estas comprobaciones, se abre una solicitud de integración para revisar los cambios antes de incorporarlos. El propietario crea los commits y sube la rama. Cada cambio de código actualiza su documentación en inglés y español dentro de la misma rama, para revisar juntos el código y su guía.
Parte 4 · Página 18 de 22 · Anterior: [Plantillas de inicialización](../3-code/130-init-templates.md) · Siguiente: [Script de compilación](15-build-script.md) · [Índice](../README.md)
