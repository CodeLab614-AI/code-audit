Parte 2 · Página 4 de 34 · Anterior: [Arquitectura](10-architecture.md) · Siguiente: [Formatos de datos](30-data-formats.md) · [Índice](../README.md)
# Línea de comandos

El CLI acepta `init`, `check` y `review`, además de `--root`, `--language`, `--json`, `--help` y `--version`. `check` valida el proyecto y `review` sigue diciendo que aún no está disponible.

## Resultados actuales

| Invocación | Resultado | Código |
|---|---|---:|
| `--version` | `0.1.0` | 0 |
| `init --language fr` | Guarda `fr` y genera archivos en inglés | 0 |
| `init --language ES` | Guarda `ES` y genera archivos en español | 0 |
| `init --language es-MX` | Guarda `es-MX` y genera archivos en español | 0 |
| `init --language pt-BR` | Guarda `pt-BR` y genera archivos en inglés | 0 |
| `init --language "es\nx"` | `invalid language: es\nx`; no escribe archivos | 1 |
| `init --language -es` | `invalid language: -es`; no escribe archivos | 1 |
| `init --language "es: x"` | `invalid language: es: x` | 1 |
| `init` fuera de un repositorio Git | `not a working Git repository: <ruta>` | 3 |
| `check` sin errores | Resumen con cantidades de problemas | 0 |
| `check` solo con avisos | Avisos y resumen | 0 |
| `check` con errores | Errores, avisos y resumen | 2 |
| `check --json` | Resultado JSON completo y problemas ordenados | 0 o 2 |
| `check` fuera de un repositorio Git | `not a working Git repository: <ruta>` | 3 |
| `review` | `review is not available yet` | 1 |

El idioma debe tener letras y números en grupos no vacíos separados por guiones simples. `init` guarda el valor tal como se recibió; `es` y los valores que empiezan con `es-`, sin importar mayúsculas, eligen archivos en español. El valor predeterminado es `en`.

## Códigos de salida

| Código | Significado | Uso actual |
|---:|---|---|
| 0 | Correcto | Ayuda, versión o inicialización exitosa |
| 1 | Error de uso | Argumentos o idioma inválidos; `review` pendiente |
| 2 | Configuración inválida | `check` encontró uno o más errores |
| 3 | No es un repositorio | `init` o `check` fuera de un repositorio o sin Git |
| 10 | Error interno | Fallo inesperado durante `init` o `check` |

Parte 2 · Página 4 de 34 · Anterior: [Arquitectura](10-architecture.md) · Siguiente: [Formatos de datos](30-data-formats.md) · [Índice](../README.md)



