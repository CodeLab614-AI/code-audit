Parte 3 · Página 21 de 32 · Anterior: [Comparador de patrones](150-config-match.md) · Siguiente: [Rango a revisar](170-review-range.md) · [Índice](../README.md)
# Tipos de revisión

**Archivo:** `src/review/types.ts` · 35 líneas · **Estado:** disponible

## Índice de la página

- ¿Qué es y para qué sirve?
- Tipos
- Dónde se usa
- Pruebas

## ¿Qué es y para qué sirve?

Este archivo define las estructuras de datos que representan los archivos cambiados y el alcance completo de una revisión de código.

Sin estas definiciones tipadas, las funciones de cálculo de rango, selección de reglas e informes tendrían que coordinar datos sueltos sin verificación del compilador.

Define las interfaces `ChangedFile` y `ReviewRange`, y el tipo de unión `ReviewRangeErrorReason`. Lo usa [`src/review/range.ts`](170-review-range.md).

## Tipos

```ts
/** Describes a file changed within a review range. */
export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  added: number;
  removed: number;
  binary: boolean;
  committed: boolean;
  uncommitted: boolean;
}

/** Specific failure reasons why a review range could not be computed. */
export type ReviewRangeErrorReason =
  | 'empty'
  | 'base-not-found'
  | 'shallow'
  | 'needs-start'
  | 'bad-ref'
  | 'no-commits';

/** Computed scope and changed files for a code review. */
export interface ReviewRange {
  mode: 'branch' | 'unpushed' | 'since-run' | 'since-ref';
  branch: string | null;
  baseLabel: string;
  baseSha: string;
  headSha: string;
  commits: { sha: string; subject: string }[];
  files: ChangedFile[];
  ignoredByConfig: string[];
  added: number;
  removed: number;
  large: boolean;
}
```

### `ChangedFile`

Representa un archivo modificado, agregado, eliminado o renombrado dentro del rango de revisión.

#### `path` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Ruta relativa al repositorio con barras diagonales normales (`/`).
- **Valores:** Cadena no vacía con la ruta actual del archivo.
- **Lo llena:** `src/review/range.ts:168`, `src/review/range.ts:186`, `src/review/range.ts:210`.
- **Lo lee:** `src/review/range.ts:203`.
- **Ejemplo:** `'src/main.ts'`.

#### `oldPath` — `string | undefined`

- **Obligatorio o predeterminado:** opcional.
- **Propósito:** Conserva la ruta anterior cuando un archivo ha sido renombrado.
- **Valores:** Ruta previa si `status` es `'renamed'`; de lo contrario, `undefined`.
- **Lo llena:** `src/review/range.ts:169`, `src/review/range.ts:187`.
- **Lo lee:** Informes y verificadores de cambios.
- **Ejemplo:** `'src/old-main.ts'`.

#### `status` — `'added' | 'modified' | 'deleted' | 'renamed'`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Estado del cambio del archivo respecto a la base de revisión.
- **Valores:** `'added'`, `'modified'`, `'deleted'` o `'renamed'`.
- **Lo llena:** `src/review/range.ts:170`, `src/review/range.ts:188`, `src/review/range.ts:211`.
- **Lo lee:** Módulos de filtrado y generación de informes.
- **Ejemplo:** `'modified'`.

#### `added` — `number`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Cantidad de líneas añadidas en el archivo (cero para archivos binarios).
- **Valores:** Entero mayor o igual a cero.
- **Lo llena:** `src/review/range.ts:171`, `src/review/range.ts:189`, `src/review/range.ts:212`.
- **Lo lee:** `src/review/range.ts:221`.
- **Ejemplo:** `15`.

#### `removed` — `number`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Cantidad de líneas eliminadas en el archivo (cero para archivos binarios).
- **Valores:** Entero mayor o igual a cero.
- **Lo llena:** `src/review/range.ts:172`, `src/review/range.ts:190`, `src/review/range.ts:213`.
- **Lo lee:** `src/review/range.ts:222`.
- **Ejemplo:** `4`.

#### `binary` — `boolean`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Indica si el archivo contiene contenido binario.
- **Valores:** `true` si contiene bytes nulos o no es texto UTF-8; de lo contrario, `false`.
- **Lo llena:** `src/review/range.ts:173`, `src/review/range.ts:191`, `src/review/range.ts:214`.
- **Lo lee:** `src/review/range.ts:221`.
- **Ejemplo:** `false`.

#### `committed` — `boolean`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Indica si parte o la totalidad de los cambios del archivo pertenecen a commits en la rama.
- **Valores:** `true` si aparece en el historial de commits revisados; de lo contrario, `false`.
- **Lo llena:** `src/review/range.ts:174`, `src/review/range.ts:192`, `src/review/range.ts:215`.
- **Lo lee:** Informes para desglosar cambios guardados y pendientes.
- **Ejemplo:** `true`.

#### `uncommitted` — `boolean`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Indica si el archivo tiene modificaciones en el árbol de trabajo sin registrar en un commit.
- **Valores:** `true` si tiene cambios locales o no tiene seguimiento; de lo contrario, `false`.
- **Lo llena:** `src/review/range.ts:175`, `src/review/range.ts:181`, `src/review/range.ts:216`.
- **Lo lee:** Informes para advertir sobre cambios locales no confirmados.
- **Ejemplo:** `false`.

### `ReviewRangeErrorReason`

Motivo específico por el cual no fue posible calcular un rango de revisión válido.

#### `value` — `'empty' | 'base-not-found' | 'shallow' | 'needs-start' | 'bad-ref' | 'no-commits'`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Identificador estable del motivo de error para la clase `ReviewRangeError`.
- **Valores:**
  - `'empty'`: no hay ningún archivo cambiado después de aplicar exclusiones.
  - `'base-not-found'`: ninguna rama base existe ni fue configurada.
  - `'shallow'`: el repositorio es un clon superficial.
  - `'needs-start'`: revisión en rama base sin commits upstream ni punto de partida.
  - `'bad-ref'`: la referencia especificada en `--since` o la corrida previa no existe.
  - `'no-commits'`: el repositorio no tiene ningún commit.
- **Lo llena:** `src/review/range.ts:16`, `src/review/range.ts:57`, `src/review/range.ts:68`, `src/review/range.ts:77`, `src/review/range.ts:98`, `src/review/range.ts:133`, `src/review/range.ts:139`, `src/review/range.ts:218`.
- **Lo lee:** Pruebas y manejadores de salida CLI futuros.
- **Ejemplo:** `'empty'`.

### `ReviewRange`

Estructura completa que delimita el alcance de la auditoría y sus cambios.

#### `mode` — `'branch' | 'unpushed' | 'since-run' | 'since-ref'`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Estrategia empleada para determinar el punto de partida de la revisión.
- **Valores:** `'branch'` (rama contra base), `'unpushed'` (commits locales sin subir), `'since-run'` (desde corrida previa) o `'since-ref'` (desde referencia `--since`).
- **Lo llena:** `src/review/range.ts:100`, `src/review/range.ts:121`, `src/review/range.ts:134`, `src/review/range.ts:145`.
- **Lo lee:** Generador de informes y metadata de corrida.
- **Ejemplo:** `'branch'`.

#### `branch` — `string | null`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Nombre de la rama actual o `null` si HEAD se encuentra suelto (desconectado).
- **Valores:** Nombre de la rama o `null`.
- **Lo llena:** `src/review/range.ts:80`, `src/review/range.ts:227`.
- **Lo lee:** Encabezado del informe y registro de corrida.
- **Ejemplo:** `'feat/plan-2-range'`.

#### `baseLabel` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Etiqueta visible del punto base de comparación.
- **Valores:** Nombre de la rama base o referencia utilizada.
- **Lo llena:** `src/review/range.ts:101`, `src/review/range.ts:122`, `src/review/range.ts:135`, `src/review/range.ts:146`.
- **Lo lee:** Encabezado y detalles del informe.
- **Ejemplo:** `'main'`.

#### `baseSha` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Identificador SHA de 40 caracteres del commit base.
- **Valores:** Hash hexadecimal de Git.
- **Lo llena:** `src/review/range.ts:102`, `src/review/range.ts:123`, `src/review/range.ts:136`, `src/review/range.ts:147`.
- **Lo lee:** Verificador de foto e informe.
- **Ejemplo:** `'403433ec40efe7cc940f0795105b83558cb5bdcd'`.

#### `headSha` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Identificador SHA de 40 caracteres del commit HEAD actual.
- **Valores:** Hash hexadecimal de Git.
- **Lo llena:** `src/review/range.ts:75`, `src/review/range.ts:229`.
- **Lo lee:** Verificador de foto y corridas.
- **Ejemplo:** `'cb00bdead6979ede322f899e4d642715485444a1'`.

#### `commits` — `{ sha: string; subject: string }[]`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Lista de commits incluidos en la revisión con su mensaje descriptivo.
- **Valores:** Arreglo de objetos con `sha` y `subject`.
- **Lo llena:** `src/review/range.ts:151`.
- **Lo lee:** Sección de detalles del informe.
- **Ejemplo:** `[{ sha: 'cb00...', subject: 'agrega login' }]`.

#### `files` — `ChangedFile[]`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Lista de archivos con modificaciones que serán revisados.
- **Valores:** Arreglo no vacío de objetos `ChangedFile`.
- **Lo llena:** `src/review/range.ts:206`.
- **Lo lee:** Módulos de lectura de líneas y selección de reglas.
- **Ejemplo:** `[{ path: 'src/main.ts', status: 'modified', ... }]`.

#### `ignoredByConfig` — `string[]`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Rutas que cambiaron pero fueron excluidas mediante `config.ignore`.
- **Valores:** Arreglo de rutas relativas ordenadas alfabéticamente.
- **Lo llena:** `src/review/range.ts:204`.
- **Lo lee:** Sección de detalles del informe.
- **Ejemplo:** `['dist/bundle.js']`.

#### `added` — `number`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Total acumulado de líneas agregadas entre todos los archivos revisados.
- **Valores:** Entero mayor o igual a cero.
- **Lo llena:** `src/review/range.ts:221`.
- **Lo lee:** Resumen del informe y evaluador de umbral de tamaño.
- **Ejemplo:** `120`.

#### `removed` — `number`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Total acumulado de líneas eliminadas entre todos los archivos revisados.
- **Valores:** Entero mayor o igual a cero.
- **Lo llena:** `src/review/range.ts:222`.
- **Lo lee:** Resumen del informe y evaluador de umbral de tamaño.
- **Ejemplo:** `15`.

#### `large` — `boolean`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Indica si la suma de líneas agregadas y eliminadas excede `config.maxChangedLines`.
- **Valores:** `true` si supera el límite configurado; de lo contrario, `false`.
- **Lo llena:** `src/review/range.ts:223`.
- **Lo lee:** Estrategia de partición de agentes e informe final.
- **Ejemplo:** `false`.

## Dónde se usa

- [`src/review/range.ts`](170-review-range.md) importa todos los tipos definidos en este archivo.
- [`src/review/range.test.ts`](../../../src/review/range.test.ts) valida las estructuras generadas.
- En tareas futuras, estos tipos serán consumidos por el selector de reglas y los generadores de informes.

## Pruebas

- `src/review/range.test.ts`: comprueba la forma de `ReviewRange` y `ChangedFile` en todos los modos de cálculo.
Parte 3 · Página 21 de 32 · Anterior: [Comparador de patrones](150-config-match.md) · Siguiente: [Rango a revisar](170-review-range.md) · [Índice](../README.md)



