Parte 3 · Página 10 de 27 · Anterior: [Rutas de configuración](050-config-paths.md) · Siguiente: [Cargador de configuración del proyecto](070-config-config.md) · [Índice](../README.md)
# Tipos de configuración

**Archivo:** `src/config/types.ts` · 38 líneas · **Estado:** disponible

## Índice de la página

- ¿Qué es y para qué sirve?
- Tipos
- Dónde se usa
- Pruebas

## ¿Qué es y para qué sirve?

Este archivo define las formas que comparten los cargadores para devolver configuración, reglas y diagnósticos.

## Tipos

```ts
// Estos son los valores normalizados que devuelve el cargador de reglas.
/** Enumera las gravedades de regla admitidas. */
export type Severity = 'critical' | 'major' | 'minor';

// El cargador deriva esta categoría de la carpeta de origen.
/** Enumera los tipos inferidos a partir de nombres de carpeta. */
export type RuleKind = 'policy' | 'rule' | 'business' | 'decision' | 'template';

// Cada elemento identifica un origen y un diagnóstico.
/** Describe un problema al cargar configuración o reglas. */
export interface Problem {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

// Aquí los valores YAML opcionales se vuelven propiedades normalizadas.
/** Guarda valores normalizados de configuración del proyecto. */
export interface Config {
  structureVersion: 1;
  language: string;
  baseBranch?: string;
  ignore: string[];
  maxChangedLines: number;
}

// `Rule` combina metadatos normalizados con su cuerpo Markdown.
/** Guarda una regla validada y su cuerpo Markdown. */
export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  appliesTo: string[];
  keywords: string[];
  kind: RuleKind;
  file: string;
  body: string;
}
```


### `Severity`

Gravedad normalizada de una regla.


#### `value` — `'critical' | 'major' | 'minor'`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Guarda una gravedad normalizada.
- **Valores:** Acepta `critical`, `major` o `minor`; `grave`, `importante` y `menor` se convierten a esos valores. Recorta espacios externos e ignora mayúsculas.
- **Lo llena:** `src/config/rules.ts:43`, `src/config/rules.ts:87-88`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `critical`.


### `RuleKind`

Categoría inferida de la carpeta de origen.


#### `value` — `'policy' | 'rule' | 'business' | 'decision' | 'template'`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Guarda la categoría singular de la carpeta de origen.
- **Valores:** Admite `policy`, `rule`, `business`, `decision` o `template`, según la carpeta.
- **Lo llena:** `src/config/rules.ts:18`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `business`.


### `Problem`

Diagnóstico producido al cargar datos.


#### `level` — `'error' | 'warning'`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Indica la gravedad del diagnóstico.
- **Valores:** `error` señala entrada inválida; si ocurre en una regla, esa regla se excluye. `warning` informa metadatos desconocidos y conserva la regla válida.
- **Lo llena:** `src/config/config.ts:27`, `src/config/config.ts:36`, `src/config/config.ts:41`, `src/config/rules.ts:29`, `src/config/rules.ts:35`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts` y `src/config/rules.test.ts`).
- **Ejemplo:** `error`.


#### `file` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Identifica el archivo que originó el diagnóstico.
- **Valores:** La ruta es relativa a la raíz del repositorio y usa barras /.
- **Lo llena:** `src/config/config.ts:20`, `src/config/rules.ts:23`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts` y `src/config/rules.test.ts`).
- **Ejemplo:** `.agents/code-audit/config.md`.

#### `message` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Explica el diagnóstico.
- **Valores:** Contiene un error de análisis o validación, o el nombre de un campo desconocido.
- **Lo llena:** `src/config/config.ts:27`, `src/config/config.ts:36`, `src/config/config.ts:41`, `src/config/config.ts:45`, `src/config/rules.ts:28-29`, `src/config/rules.ts:35`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts` y `src/config/rules.test.ts`).
- **Ejemplo:** `config.md not found`.

### `Config`

Configuración normalizada del proyecto.


#### `structureVersion` — `1`

- **Obligatorio o predeterminado:** obligatorio; si falta, vale 1.
- **Propósito:** Identifica la versión de estructura de configuración.
- **Valores:** Solo se acepta 1. Otro valor produce un error y conserva el valor predeterminado.
- **Lo llena:** `src/config/config.ts:8-9`, `src/config/config.ts:50-52`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts`).
- **Ejemplo:** `1`.

#### `language` — `string`

- **Obligatorio o predeterminado:** obligatorio; si falta, vale `en`.
- **Propósito:** Guarda el idioma solicitado.
- **Valores:** Conserva cualquier texto no vacío; un valor vacío o no textual produce un error y mantiene `en`.
- **Lo llena:** `src/config/config.ts:8-10`, `src/config/config.ts:53-55`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts`).
- **Ejemplo:** `es`.

#### `baseBranch` — `string`

- **Obligatorio o predeterminado:** opcional; sin valor predeterminado.
- **Propósito:** Guarda el nombre de la rama base.
- **Valores:** Si se omite, la propiedad queda ausente. Si aparece, acepta cualquier texto, incluso vacío; un valor no textual produce un error.
- **Lo llena:** `src/config/config.ts:57-59`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts`).
- **Ejemplo:** `main`.

#### `ignore` — `string[]`

- **Obligatorio o predeterminado:** obligatorio; si falta, vale `[]`.
- **Propósito:** Guarda patrones de rutas para ignorar.
- **Valores:** Un texto se vuelve una lista de un elemento; también acepta una lista de textos. Otro tipo produce un error y conserva `[]`.
- **Lo llena:** `src/config/config.ts:11`, `src/config/config.ts:61-64`, `src/config/config.ts:80-83`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts`).
- **Ejemplo:** `["vendor/**"]`.

#### `maxChangedLines` — `number`

- **Obligatorio o predeterminado:** obligatorio; si falta, vale 1000.
- **Propósito:** Guarda el límite de líneas modificadas.
- **Valores:** Un entero positivo reemplaza 1000; cero, negativos, fracciones o valores no numéricos producen un error y conservan 1000.
- **Lo llena:** `src/config/config.ts:12`, `src/config/config.ts:66-69`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/config.test.ts`).
- **Ejemplo:** `250`.

### `Rule`

Regla validada y cuerpo Markdown.


#### `id` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Identifica la regla.
- **Valores:** Acepta cualquier texto con al menos un carácter; no recorta espacios.
- **Lo llena:** `src/config/rules.ts:41`, `src/config/rules.ts:77-82`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `BIZ-003`.

#### `title` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Guarda el título de la regla.
- **Valores:** Acepta cualquier texto con al menos un carácter; no recorta espacios.
- **Lo llena:** `src/config/rules.ts:42`, `src/config/rules.ts:77-82`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `Montos en centavos`.

#### `severity` — `Severity`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Guarda la gravedad validada de la regla.
- **Valores:** Usa `critical`, `major` o `minor`; consulta `Severity` para los alias aceptados.
- **Lo llena:** `src/config/rules.ts:43`, `src/config/rules.ts:85-91`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `major`.

#### `appliesTo` — `string[]`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Guarda los patrones de ruta donde se aplica la regla.
- **Valores:** En una carpeta `policies/` (políticas), omitir el campo o dar una lista vacía produce el patrón global. Los demás tipos requieren patrones no vacíos.
- **Lo llena:** `src/config/rules.ts:44`, `src/config/rules.ts:95-112`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `["src/billing/**"]`.

#### `keywords` — `string[]`

- **Obligatorio o predeterminado:** obligatorio; si falta, vale `[]`.
- **Propósito:** Guarda palabras clave asociadas con la regla.
- **Valores:** Un texto se vuelve una lista de un elemento; también acepta una lista de textos. Si falta, usa `[]`; otro tipo invalida la regla.
- **Lo llena:** `src/config/rules.ts:45`, `src/config/rules.ts:116-120`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `["precio", "total"]`.

#### `kind` — `RuleKind`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Guarda la categoría derivada de la carpeta de origen.
- **Valores:** Usa el valor singular asociado con las carpetas `policies/`, `rules/`, `business/`, `decisions/` o `templates/`.
- **Lo llena:** `src/config/rules.ts:18`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `business`.

#### `file` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Guarda la ruta del archivo de la regla.
- **Valores:** La ruta es relativa a la raíz del repositorio y usa barras /.
- **Lo llena:** `src/config/rules.ts:23`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `.agents/code-audit/business/money.md`.

#### `body` — `string`

- **Obligatorio o predeterminado:** obligatorio.
- **Propósito:** Conserva el contenido Markdown posterior al encabezado YAML.
- **Valores:** Guarda el texto posterior al bloque YAML inicial, incluido el salto de línea final si existe.
- **Lo llena:** `src/config/rules.ts:26`, `src/config/rules.ts:50`.
- **Lo lee:** Hoy ningún módulo; lo usan las pruebas (`src/config/rules.test.ts`).
- **Ejemplo:** `Representa montos en centavos.\n`.

## Dónde se usa

- [Cargador de configuración](070-config-config.md) usa `Config` y `Problem` en el contrato de `loadConfig`.
- [Cargador de reglas](080-config-rules.md) usa `Rule` y `Problem` en el contrato de `loadRules`.

Hoy ningún módulo de producción consume esos resultados; las pruebas indicadas en cada campo los leen.

## Pruebas

- `src/config/config.test.ts`: valores predeterminados y validación de configuración.
- `src/config/rules.test.ts`: normalización de reglas y diagnósticos.

Parte 3 · Página 10 de 27 · Anterior: [Rutas de configuración](050-config-paths.md) · Siguiente: [Cargador de configuración del proyecto](070-config-config.md) · [Índice](../README.md)


