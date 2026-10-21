Parte 2 · Página 5 de 34 · Anterior: [Línea de comandos](20-cli.md) · Siguiente: [Entrada del programa](../3-code/010-bin.md) · [Índice](../README.md)
# Formatos de datos

Este documento define la estructura y el contrato de validación de los archivos de intercambio de datos de `code-audit`, comenzando por `findings.json` versión 1.

`run.json` se incorporará a esta misma especificación en la Tarea 9 del Plan 2.

## Contrato de `findings.json` v1

`findings.json` almacena los resultados emitidos por las sesiones independientes de revisión antes de generar el informe final. El archivo utiliza nombres en snake_case porque es producido por agentes de inteligencia artificial y luego normalizado por el programa.

### Esquema global

```json
{
  "schema_version": 1,
  "summary": "Resumen conciso en tres líneas como máximo.",
  "criteria": [
    { "number": 1, "status": "met", "reason": "Opcional" }
  ],
  "findings": [],
  "out_of_scope": [],
  "ideas": [],
  "suggested_rules": [],
  "impact": [],
  "discarded": []
}
```

### Campos de nivel superior

| Campo | Tipo | Obligatorio | Comportamiento si es inválido |
|---|---|---|---|
| `schema_version` | `number` | Sí | Si difiere de `1`, rechazo total del archivo (`FindingsInvalidError`). |
| `summary` | `string` | Sí | Si no es texto, rechazo total del archivo (`FindingsInvalidError`). |
| `findings` | `array` | Sí | Si no es lista, rechazo total del archivo (`FindingsInvalidError`). |
| `criteria` | `array` | No | Si no es lista, se toma como lista vacía y se registra en notas. |
| `out_of_scope` | `array` | No | Si no es lista, se toma como lista vacía y se registra en notas. |
| `ideas` | `array` | No | Si no es lista, se toma como lista vacía y se registra en notas. |
| `suggested_rules` | `array` | No | Si no es lista, se toma como lista vacía y se registra en notas. |
| `impact` | `array` | No | Si no es lista, se toma como lista vacía y se registra en notas. |
| `discarded` | `array` | No | Si no es lista, se toma como lista vacía y se registra en notas. |

Cualquier contenido inicial que no sea un objeto JSON válido (incluyendo texto mal formado) causa el rechazo total inmediato con `FindingsInvalidError`.

### Regla de interpretación de valores null

Las sesiones de revisión automáticas con modelos de lenguaje suelen emitir `null` para expresar la ausencia de un valor opcional. Para evitar la pérdida injustificada de hallazgos válidos:

- En **todo campo opcional**, tanto del hallazgo (`end_line`, `rule_id`, `suggestion`, `existing`, `related_note`, `related_findings`, `related_criteria`, `verified`) como del nivel superior (`criteria`, `out_of_scope`, `ideas`, `suggested_rules`, `impact`, `discarded`) y de los elementos de sus listas (`existing.line`, `out_of_scope[].line`, `suggested_rules[].from_finding`, `criteria[].reason`), el valor `null` equivale exactamente a no haber incluido el campo: **no provoca el descarte del hallazgo ni genera notas de advertencia**.
- **Excepción obligatoria:** `line: null` en un hallazgo sin `whole_file: true` se considera ausencia del campo obligatorio `line` y descarta el hallazgo con `missing or invalid field: line`.

### Campos de cada hallazgo (`findings`)

Cada elemento dentro de `findings` debe ser un objeto. Si no lo es, se descarta con el motivo `finding is not an object`.

| Campo | Tipo | Obligatorio | Comportamiento si es inválido |
|---|---|---|---|
| `id` | `string` | Sí | Texto no vacío. Si falta o se repite (sin importar mayúsculas), se descarta con `missing or invalid field: id` o `duplicate id: <id>`. |
| `title` | `string` | Sí | Texto no vacío. Si falta, se descarta con `missing or invalid field: title`. |
| `severity` | `string` | Sí | Debe coincidir con `critical`, `major`, `minor`, `grave`, `importante` o `menor`. Si no coincide, se descarta con `invalid severity: <valor>`. |
| `file` | `string` | Sí | Ruta relativa existente dentro del repositorio sin enlaces que salgan de la raíz. Si falla, se descarta con `invalid path: <file>` o `file not found: <file>`. |
| `impact` | `string` | Sí | Texto no vacío. Si falta, se descarta con `missing or invalid field: impact`. |
| `whole_file` | `boolean` | No | Si es `true`, se ignoran `line`, `end_line` y la comprobación de la cita. |
| `line` | `number` | Condicional | Entero positivo (≥ 1). Obligatorio salvo que `whole_file` sea `true`. Si falta o está fuera de rango, se descarta. |
| `end_line` | `number` | No | Entero positivo (≥ 1). Si falta o es `null`, equivale a `line`. Si es menor que `line`, se descarta con `end_line is before line`. |
| `quote` | `string` | Sí | Texto no vacío tras quitar espacios. Si no coincide con las líneas indicadas del archivo, se descarta. |
| `suggestion` | `object` | No | Debe contener `start_line` y `code`. Si viene mal, se elimina del hallazgo y se anota en notas. |
| `rule_id` | `string` | No | Debe coincidir con una regla seleccionada. Si no existe entre las elegidas, se descarta el hallazgo. |
| `related_findings`| `array` | No | Lista de identificadores. Se eliminan referencias inválidas, descartadas o cíclicas; el hallazgo continúa. |
| `related_criteria`| `array` | No | Lista de números de criterio. Se eliminan los números que no existen en la ficha de la tarea. |
| `related_note` | `string` | No | Texto explicativo. Si tiene tipo incorrecto, se elimina y se anota en notas. |
| `existing` | `object` | No | Referencia `{ file, line, note }`. Si el archivo o línea no son válidos, se elimina y se anota. |
| `verified` | `boolean` | No | Valor booleano. Si tiene tipo incorrecto, se asume `false` y se anota en notas. |

### Orden determinista de los hallazgos

Los hallazgos válidos se ordenan de forma determinista aplicando sucesivamente las siguientes claves de clasificación:

1. **Gravedad:** `critical` primero, luego `major` y finalmente `minor`.
2. **Ruta del archivo (`file`):** Orden alfabético estricto por código Unicode.
3. **Alcance de archivo:** Si coinciden en archivo, un hallazgo con `whole_file: true` precede a uno con línea específica.
4. **Línea inicial (`line`):** Orden ascendente numérico de la línea inicial (los hallazgos sin línea se consideran en línea 0).
5. **Orden de entrada:** Si coinciden en todos los criterios anteriores, se mantiene el orden relativo original del archivo de entrada.

### Formato de los elementos de las listas auxiliares

#### Criterios de aceptación (`criteria`)

Evalúa los criterios definidos en la ficha de la tarea (`task`):

- **Propiedades de cada elemento:**
  - `number`: Número entero correspondiente a la posición del criterio en la ficha de la tarea (iniciando en 1).
  - `status`: Estado del criterio, obligatoriamente `'met'`, `'partial'` o `'not_met'`.
  - `reason`: Cadena de texto opcional con la justificación del dictamen.
- **Entradas inválidas:** Si el elemento no es objeto, su número no es un entero en rango, su estado no es uno de los tres admitidos, o su razón no es texto, el elemento se ignora y se anota en notas: `invalid criterion entry <json>, ignored`.
- **Números duplicados:** Si se recibe un número de criterio ya evaluado, se conserva la primera aparición y se descarta la repetición con la nota: `duplicate criterion number <n>, first entry retained`.
- **Criterios no evaluados (`not_evaluated`):** Todo criterio de la ficha que no haya sido reportado por la sesión se completa automáticamente con el estado `not_evaluated`, su número y el texto original del criterio.
- **Sin ficha de tarea:** Si la validación se realiza sin tarea (`task` ausente), `criteria` siempre devuelve una lista vacía `[]`.

#### Modificaciones fuera de alcance (`out_of_scope`)

Registra cambios detectados que no guardan relación con la tarea revisada:

- **Propiedades de cada elemento:**
  - `file`: Ruta relativa al repositorio (cadena obligatoria). Aplica las mismas comprobaciones que los hallazgos: existencia en disco, archivo regular y confinamiento dentro del repositorio.
  - `line`: Número entero positivo opcional. Si se omite o es `null`, se asocia a la totalidad del archivo.
  - `note`: Texto explicativo obligatorio que detalla la modificación ajena.
- **Entradas inválidas:** Si falta `file` o `note`, el elemento se ignora con: `invalid out_of_scope entry <json>, ignored`. Si el archivo no existe o sale del repositorio, se anota: `invalid out_of_scope file "<file>": <reason>, ignored`. Si `line` no es un entero o supera el total de líneas del archivo, se anota: `line <line> is outside <file> in out_of_scope, ignored`.

#### Ideas de mejora (`ideas`)

Lista de propuestas adicionales identificadas durante la revisión:

- **Formato:** Cada elemento debe ser una cadena de texto (`string`). Los valores no textuales se filtran y descartan silenciosamente.
- **Límite de 5 ideas:** El validador admite un máximo de 5 ideas. Si la entrada incluye más de 5, conserva únicamente las primeras 5 y emite una nota: `retained first 5 ideas (received <n>)`.

#### Reglas sugeridas (`suggested_rules`)

Propuestas de nuevas reglas de proyecto inspiradas en los hallazgos detectados:

- **Propiedades de cada elemento:**
  - `text`: Texto descriptivo obligatorio de la regla sugerida.
  - `from_finding`: Identificador opcional del hallazgo que motivó la propuesta.
- **Resolución del hallazgo de origen:** Si `from_finding` se indica y coincide (sin distinguir mayúsculas) con un hallazgo conservado en la validación, se vincula con la grafía exacta de dicho hallazgo (`fromFinding`); si no coincide o no se indica, el campo queda indefinido.
- **Entradas inválidas:** Si el elemento no es objeto, se anota: `suggested_rules entry must be an object, ignored`. Si falta `text` o no es texto, se anota: `suggested_rules entry missing text, ignored`.

#### Impacto global (`impact`)

Observaciones generales sobre el impacto del conjunto de cambios:

- **Formato:** Cada elemento debe ser una cadena de texto (`string`). Se conservan todas las cadenas válidas y se descartan los elementos que no sean texto.

#### Hallazgos descartados por la sesión (`discarded`)

Permite a la sesión registrar hallazgos que descartó deliberadamente antes de concluir su evaluación:

- **Propiedades de cada elemento:**
  - `id`: Identificador del hallazgo. Si falta o es vacío, se genera una etiqueta posicional `#1`, `#2`, etc.
  - `title`: Título del hallazgo. Si falta, se normaliza como cadena vacía `""`.
  - `reason`: Causa del descarte. Si falta, se normaliza como cadena vacía `""`.
- **Entradas no objeto:** Si un elemento no es un objeto, se reemplaza por `{ id: "#<posición>", title: "", reason: "" }`.
- **Combinación en la salida:** Estos elementos se preservan en `data.discarded` en los datos normalizados, mientras que los descartes producidos por el propio validador se devuelven en la propiedad superior `discarded`.

### Regla de comprobación de la cita (`quote`)

La comprobación de la cita verifica que el código citado exista efectivamente en la versión actual del archivo:

1. Se extraen las líneas del archivo comprendidas entre `line` y `end_line`, ambos inclusive.
2. Cada línea del archivo se normaliza eliminando espacios en los extremos y colapsando rachas consecutivas de espacios o tabuladores en un único espacio en blanco.
3. Se eliminan las líneas vacías al inicio y al final de `quote`. Si no queda texto, el hallazgo se descarta.
4. Cada línea de `quote` se normaliza aplicando la misma regla de espacios y tabuladores.
5. Se verifica que el texto de la cita normalizada aparezca dentro de las líneas normalizadas del archivo unidas por saltos de línea. Si no coincide, se descarta con el motivo: `quote not found in <file> at lines <line>-<end_line>`.

### Motivos exactos de descarte

Todo hallazgo descartado genera una entrada en la lista de descartados con uno de estos diez mensajes exactos en inglés:

- `missing or invalid field: <campo>`
- `invalid severity: <valor>`
- `end_line is before line`
- `duplicate id: <id>`
- `finding is not an object`
- `rule <rule_id> is not among the selected rules`
- `invalid path: <file>`
- `file not found: <file>`
- `line <n> is outside <file> (<total> lines)`
- `quote not found in <file> at lines <line>-<end_line>`

### Ejemplo completo y válido

El siguiente ejemplo corresponde a la ejecución del plan con la totalidad de los campos validados con éxito (0 descartados y 0 notas):

```json
{
  "schema_version": 1,
  "summary": "Tres líneas como máximo: qué hizo el cambio y qué está mal.",
  "criteria": [
    {
      "number": 2,
      "status": "not_met",
      "reason": "Lo calcula con decimales."
    }
  ],
  "findings": [
    {
      "id": "F1",
      "title": "El total se calcula con decimales y puede cobrar mal",
      "severity": "critical",
      "file": "src/billing/total.ts",
      "line": 41,
      "end_line": 41,
      "whole_file": false,
      "quote": "const total = price * 1.16",
      "impact": "Qué pasaría en la práctica.",
      "suggestion": {
        "start_line": 40,
        "code": "const priceCents = item.priceCents\n…"
      },
      "rule_id": "BIZ-003",
      "related_findings": [],
      "related_criteria": [2],
      "related_note": "Se resuelve también con el problema 3.",
      "existing": {
        "file": "src/ui/Button.tsx",
        "line": 1,
        "note": "Botón con estado «cargando»."
      },
      "verified": true
    }
  ],
  "out_of_scope": [
    {
      "file": "src/auth/session.ts",
      "line": 88,
      "note": "Sesiones de usuario."
    }
  ],
  "ideas": [
    "El cálculo del IVA está repetido en dos lugares."
  ],
  "suggested_rules": [
    {
      "text": "Todo botón que cobre se desactiva mientras espera.",
      "from_finding": "F1"
    }
  ],
  "impact": [
    "El total también lo usan las facturas y los reembolsos."
  ],
  "discarded": [
    {
      "id": "F7",
      "title": "…",
      "reason": "El verificador encontró la validación en la línea 12."
    }
  ]
}
```

Parte 2 · Página 5 de 34 · Anterior: [Línea de comandos](20-cli.md) · Siguiente: [Entrada del programa](../3-code/010-bin.md) · [Índice](../README.md)

