Parte 2 · Página 4 de 17 · Anterior: [Arquitectura](10-architecture.md) · Siguiente: [Entrada del programa](../3-code/010-bin.md) · [Índice](../README.md)
# Línea de comandos

La interfaz de línea de comandos (CLI) lee el comando y las opciones escritas después del nombre del programa. Hoy `--help` y `--version` terminan correctamente. Los comandos `init`, `check` y `review` muestran que no están disponibles y devuelven el código `1`.

## Resultados reales

Estos resultados se obtuvieron con `node skills/code-audit/code-audit.mjs`:

| Invocación | Salida | Código |
|---|---|---:|
| `--version` | `0.1.0` | 0 |
| `nope` | `Unknown command: nope` | 1 |
| `init --bogus` | `Unknown option: --bogus` | 1 |
| `init --root` | `Missing value for --root` | 1 |
| `init --language` | `Missing value for --language` | 1 |
| `init` | `init is not available yet` | 1 |
| `check` | `check is not available yet` | 1 |
| `review` | `review is not available yet` | 1 |

Las opciones `--root` y `--language` consumen el argumento siguiente, pero estos comandos no usan esos valores. `--json` se acepta, pero no cambia la salida del marcador. La ayuda funciona sola con `--help` o `-h`, y también después de un comando.

## Salida de ayuda

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

## Códigos de salida

Un código de salida es el número que devuelve un comando para indicar al shell si terminó correctamente.

| Código | Significado actual | Cuándo se usa |
|---:|---|---|
| 0 | Correcto | Muestra ayuda o versión |
| 1 | Error de uso | Comando u opción desconocidos, valor faltante o comando no disponible |
| 2 | Configuración inválida | Está definido en `ExitCode`; ningún comando actual lo devuelve |
| 3 | No es un repositorio | Está definido en `ExitCode`; ningún comando actual lo devuelve |
| 10 | Error interno | Un error inesperado llega a `src/bin.ts` |
Parte 2 · Página 4 de 17 · Anterior: [Arquitectura](10-architecture.md) · Siguiente: [Entrada del programa](../3-code/010-bin.md) · [Índice](../README.md)
