Parte 4 · Página 32 de 32 · Anterior: [Estándar de documentación](20-documentation-standard.md) · (última) · [Índice](../README.md)
# Hoja de ruta

- **Tarea 1 — Hecha:** configuración de Bun, esqueleto del CLI y compilación a un solo archivo.
- **Tarea 2 — Hecha:** lector y validador de encabezados YAML.
- **Tarea 3 — Hecha:** cargar y validar la configuración del proyecto y sus reglas.
- **Tarea 4 — Hecha:** cargar y validar una ficha de tarea en Markdown.
- **Tarea 5 — Hecha:** ejecutar Git mediante una interfaz protegida de solo lectura.
- **Tarea 6 — Hecha:** crear configuración bilingüe sin reemplazar archivos existentes y conectar `init` al CLI.
- **Tarea 7 — Hecha:** validar configuración, ids de reglas duplicados y patrones de archivos, y conectar `check` al CLI. El Plan 1 está completo.

## Plan 2: Revisión sin IA

- **Tarea 1 — Hecha:** cálculo del rango a revisar (`computeRange`, `resolveBase`, tipos de revisión y comparador de patrones `createMatcher`).
- **Tarea 2 — Hecha:** líneas cambiadas (`readChangedLines` y `ChangedLines` mediante diff unificado contra la copia de trabajo y lectura de archivos sin seguimiento).
- **Tarea 3 — Hecha:** selección de reglas (`selectRules`, `SelectedRule`, `SelectionReason` y `normalizeForKeywords` por políticas, patrones con renombrados y palabras clave con acentos y términos completos).
- **Tarea 4 — Hecha:** foto del repositorio (`takeSnapshot`, `compareSnapshots`, `Snapshot` y `SnapshotChange` para registrar y comparar el estado de Git, el índice y los archivos no ignorados).
- **Tarea 5 — Hecha:** esquema y validación de `findings.json` (`validateFindings`, `FindingsInvalidError`, `FINDINGS_SCHEMA_VERSION`, tipos normalizados y descarte exacto con comprobación de citas y límites de ruta).
- **Planeado:** modelo de informe, textos fijos y generación de informes HTML y Markdown.

## Plan 3: Mapa del código

**Planeado:** usar tree-sitter, una herramienta que convierte código fuente en una estructura analizable, para mapear importaciones, dependencias, componentes y utilidades del proyecto.

## Plan 4: Sesiones y skill

**Planeado:** abrir nuevas sesiones de revisión y verificación con el mismo agente que inicia la skill; avisar cuando un cambio sea grande; entregar las instrucciones `SKILL.md` y las pruebas de la skill.

Consulta la [página del comprobador de documentación](17-docs-check.md) para ver sus comprobaciones y ejemplos.
Parte 4 · Página 32 de 32 · Anterior: [Estándar de documentación](20-documentation-standard.md) · (última) · [Índice](../README.md)



