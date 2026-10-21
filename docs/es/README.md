# Documentación de code-audit

Empieza aquí: [página 1](1-overview/10-what-is-code-audit.md).

code-audit revisa cambios de una rama contra las reglas del proyecto y presenta el resultado.

```mermaid
flowchart TD
    A["Parte 1: ¿qué es y cómo se usa?"] --> B["Parte 2: ¿cómo está construido?"]
    B --> C["Parte 3: ¿qué hace cada archivo?"]
    C --> D["Parte 4: ¿cómo trabajo en el proyecto?"]
```

## Parte 1: Descripción general

1. [Qué es code-audit](1-overview/10-what-is-code-audit.md) — El propósito y las herramientas que existen hoy.
2. [Uso de code-audit hoy](1-overview/20-usage.md) — Compilar y ejecutar el programa de línea de comandos.

Al terminar esta parte sabrás qué contiene el proyecto y cómo ejecutar su programa actual de línea de comandos.

## Parte 2: Arquitectura

3. [Arquitectura](2-architecture/10-architecture.md) — Los módulos actuales y sus conexiones reales.
4. [Línea de comandos](2-architecture/20-cli.md) — Los comandos, opciones y códigos de salida actuales.
5. [Formatos de datos](2-architecture/30-data-formats.md) — Contratos de findings.json y run.json.

Al terminar esta parte entenderás cómo colaboran los módulos existentes y qué hace el CLI hoy.

## Parte 3: Código

6. [Entrada del programa](3-code/010-bin.md) — Inicia el CLI y fija el código de salida del proceso.
7. [Línea de comandos](3-code/020-cli.md) — Interpreta argumentos y escribe resultados.
8. [Códigos de salida y versión](3-code/030-exit-codes-and-version.md) — Define los códigos y lee la versión del paquete.
9. [Lector de frontmatter](3-code/040-config-frontmatter.md) — Interpreta un encabezado YAML y el cuerpo Markdown.
10. [Rutas de configuración](3-code/050-config-paths.md) — Nombra carpetas y tipos de configuración.
11. [Tipos de configuración](3-code/060-config-types.md) — Define las formas de configuración, regla y problema.
12. [Cargador de configuración del proyecto](3-code/070-config-config.md) — Lee y valida config.md.
13. [Cargador de reglas](3-code/080-config-rules.md) — Carga y valida reglas Markdown.
14. [Cargador de fichas de tarea](3-code/090-config-task.md) — Carga y valida fichas de tareas en Markdown.
15. [Interfaz Git de solo lectura](3-code/100-git-git.md) — Protege los comandos Git y sus opciones permitidos.
16. [Ayudantes de prueba para repositorios temporales](3-code/110-test-helpers-repo.md) — Crea repositorios Git aislados para las pruebas.
17. [Inicialización del proyecto](3-code/120-init-init.md) — Crea la configuración sin reemplazar archivos existentes.
18. [Plantillas de inicialización](3-code/130-init-templates.md) — Define los archivos generados en inglés y español.
19. [Comprobador del proyecto](3-code/140-check-check.md) — Valida la configuración, las reglas y los patrones de archivos.
20. [Comparador de patrones](3-code/150-config-match.md) — Evalúa rutas de archivos contra patrones comodín.
21. [Tipos de revisión](3-code/160-review-types.md) — Define los tipos de archivos cambiados y alcance de revisión.
22. [Rango a revisar](3-code/170-review-range.md) — Determina los commits, archivos y líneas que entran en la revisión.
23. [Líneas cambiadas](3-code/180-review-changes.md) — Lee las líneas agregadas y eliminadas de cada archivo cambiado.
24. [Selección de reglas](3-code/190-review-select.md) — Elige qué reglas aplican según archivos cambiados, líneas y tarea.
25. [Foto del repositorio](3-code/200-review-snapshot.md) — Captura y compara el estado criptográfico y estructural del repositorio.
26. [Esquema de hallazgos](3-code/210-findings-schema.md) — Define la versión y tipos normalizados de hallazgos.
27. [Validador de hallazgos](3-code/220-findings-validate.md) — Valida, normaliza y descarta hallazgos contra el repositorio.
28. [Modelo del informe](3-code/230-report-model.md) — Construye el modelo de vista para informes HTML y Markdown.
29. [Textos fijos e idioma](3-code/240-report-i18n.md) — Centraliza cadenas fijas, traducciones y resolución de idioma.

Al terminar esta parte podrás seguir cada archivo fuente actual y sus pruebas.

## Parte 4: Desarrollo

30. [Desarrollo](4-development/10-development.md) — Requisitos, comprobaciones y flujo de solicitud de integración.
31. [Script de compilación](4-development/15-build-script.md) — Crea el CLI independiente para Node.js.
32. [Comprobador de documentación](4-development/17-docs-check.md) — Valida la documentación pública y sus referencias al código.
33. [Estándar de documentación](4-development/20-documentation-standard.md) — Reglas para mantener estas páginas.
34. [Hoja de ruta](4-development/30-roadmap.md) — El trabajo que falta en el proyecto.

Al terminar esta parte sabrás compilar, comprobar y mantener el proyecto actual.
