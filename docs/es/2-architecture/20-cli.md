Parte 2 · Página 4 de 22 · Anterior: [Arquitectura](10-architecture.md) · Siguiente: [Entrada del programa](../3-code/010-bin.md) · [Índice](../README.md)
# Línea de comandos

El CLI acepta `init`, `check` y `review`, además de `--help` y `--version`. `init` crea la configuración del proyecto. `check` y `review` siguen diciendo que aún no están disponibles.

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
| `check` | `check is not available yet` | 1 |
| `review` | `review is not available yet` | 1 |

El idioma debe tener letras y números en grupos no vacíos separados por guiones simples. `init` guarda el valor tal como se recibió; `es` y los valores que empiezan con `es-`, sin importar mayúsculas, eligen archivos en español. El valor predeterminado es `en`.

## Códigos de salida

| Código | Significado | Uso actual |
|---:|---|---|
| 0 | Correcto | Ayuda, versión o inicialización exitosa |
| 1 | Error de uso | Argumentos o idioma inválidos; `check` y `review` pendientes |
| 2 | Configuración inválida | Definido, pero no devuelto por los comandos actuales |
| 3 | No es un repositorio | Inicialización fuera de un repositorio de trabajo |
| 10 | Error interno | Fallo inesperado durante la inicialización |

Parte 2 · Página 4 de 22 · Anterior: [Arquitectura](10-architecture.md) · Siguiente: [Entrada del programa](../3-code/010-bin.md) · [Índice](../README.md)
