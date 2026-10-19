Parte 1 · Página 1 de 17 · Siguiente: [Uso de code-audit hoy](20-usage.md) · [Índice](../README.md)
# Qué es code-audit

## El problema

La inteligencia artificial (IA) puede escribir mucho código, así que el cuello de botella suele ser una persona, normalmente el líder técnico (quien coordina las decisiones técnicas), que revisa a mano todos esos cambios. Una rama es una línea de trabajo separada dentro del repositorio, la carpeta que contiene el código del proyecto. Revisar cada cambio manualmente consume tiempo que podría dedicarse a otras tareas.

## La meta del proyecto

La meta es que cada proyecto escriba sus propias reglas técnicas, de negocio y de estructura, y que code-audit compare con ellas los cambios de una rama para que una persona no tenga que leerlos todos. Esa función de revisión es la meta del proyecto; todavía no funciona.

## Qué existe hoy

- El [programa de línea de comandos](../2-architecture/20-cli.md), que se maneja escribiendo instrucciones en una ventana de texto, responde a `--help` y `--version`.
- El [lector de encabezados](../3-code/040-config-frontmatter.md) lee bloques YAML al inicio de un documento. YAML es un formato de texto para datos con nombre. Ningún comando usa este lector todavía.
- El [programa de compilación](../4-development/15-build-script.md) transforma el código fuente, las instrucciones escritas por quienes desarrollan el proyecto, en un programa que se puede ejecutar.
- El [comprobador de documentación](../4-development/17-docs-check.md) revisa las guías públicas del proyecto.

## Qué falta

La función de revisión descrita arriba todavía no está implementada; la [hoja de ruta](../4-development/30-roadmap.md) enumera el trabajo pendiente.
Parte 1 · Página 1 de 17 · Siguiente: [Uso de code-audit hoy](20-usage.md) · [Índice](../README.md)
