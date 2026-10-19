#!/usr/bin/env node

// src/exit-codes.ts
var ExitCode = {
  OK: 0,
  USAGE: 1,
  CONFIG_INVALID: 2,
  NOT_A_REPO: 3,
  INTERNAL: 10
};

// src/git/git.ts
import { execFile as execFileCallback } from "node:child_process";
import { stat } from "node:fs/promises";
var READ_ONLY_COMMANDS = [
  "diff",
  "log",
  "show",
  "status",
  "rev-parse",
  "merge-base",
  "ls-files",
  "cat-file",
  "grep",
  "blame"
];
var MAX_BUFFER = 256 * 1024 * 1024;
var DANGEROUS_LONG_OPTIONS = [
  "output",
  "open-files-in-pager",
  "ext-diff",
  "textconv",
  "exec-path",
  "git-dir",
  "work-tree",
  "filters"
];

class GitForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "GitForbiddenError";
  }
}

class GitError extends Error {
  exitCode;
  stderr;
  reason;
  constructor(message, exitCode, stderr, reason = "git-failed") {
    super(message);
    this.name = "GitError";
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.reason = reason;
  }
}

class NotARepoError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotARepoError";
  }
}
async function runGit(root, args, options = {}) {
  validateArguments(args);
  await requireDirectory(root);
  const command = args[0];
  const commandArgs = args.slice(1);
  const safetyArgs = command === "diff" || command === "log" || command === "show" ? ["--no-ext-diff", "--no-textconv"] : command === "blame" ? ["--no-textconv"] : [];
  const env = safeEnvironment();
  try {
    const result = await executeGit([
      "--no-pager",
      "-c",
      "core.quotePath=false",
      "-c",
      "color.ui=false",
      command,
      ...safetyArgs,
      ...commandArgs
    ], root, env, options.maxBuffer ?? MAX_BUFFER);
    return result.stdout;
  } catch (error) {
    const failure = error;
    if (failure.code === "ENOENT") {
      if (!await isDirectory(root))
        throw directoryError(root);
      throw new GitError("git is not installed or not in PATH", null, failure.stderr ?? "", "git-unavailable");
    }
    const stderr = failure.stderr ?? "";
    if (command === "grep" && Number(failure.code) === 1 && stderr.length === 0)
      return "";
    if (failure.code === "ENOBUFS" || failure.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      const limit = options.maxBuffer ?? MAX_BUFFER;
      const size = limit === MAX_BUFFER ? "256 MiB" : `${limit} bytes`;
      throw new GitError(`git output exceeded ${size}`, null, stderr, "output-limit");
    }
    const exitCode = typeof failure.code === "number" ? failure.code : null;
    const detail = stderr.trim();
    throw new GitError(detail || `git ${command} failed`, exitCode, stderr);
  }
}
async function findRepoRoot(cwd) {
  try {
    const root = (await runGit(cwd, ["rev-parse", "--show-toplevel"])).replace(/\r?\n$/, "");
    const bare = (await runGit(cwd, ["rev-parse", "--is-bare-repository"])).trim();
    if (bare === "true")
      throw new NotARepoError(`not a working Git repository: ${cwd}`);
    return root;
  } catch (error) {
    if (error instanceof NotARepoError)
      throw error;
    if (error instanceof GitError && error.reason === "git-unavailable") {
      throw new NotARepoError("Git is not installed or not in PATH");
    }
    if (error instanceof GitError && error.reason === "directory")
      throw new NotARepoError(error.message);
    throw new NotARepoError(`not a working Git repository: ${cwd}`);
  }
}
function validateArguments(args) {
  const command = args[0];
  if (!command || command.startsWith("-") || !READ_ONLY_COMMANDS.includes(command)) {
    throw new GitForbiddenError(`Git subcommand is not allowed: ${command ?? "(missing)"}`);
  }
  for (const argument of args.slice(1)) {
    if (isForbiddenArgument(command, argument)) {
      throw new GitForbiddenError(`Git option is not allowed for ${command}: ${argument}`);
    }
  }
}
function isForbiddenArgument(command, argument) {
  if (argument.startsWith("--")) {
    const name = argument.slice(2).split("=", 1)[0];
    if (!name)
      return false;
    if (name.startsWith("output-indicator-"))
      return false;
    return DANGEROUS_LONG_OPTIONS.some((option) => option.startsWith(name));
  }
  if (!argument.startsWith("-") || argument.startsWith("--"))
    return false;
  if (argument === "-c" || argument.startsWith("-c"))
    return true;
  if (["diff", "log", "show"].includes(command) && argument.includes("o"))
    return true;
  if (command === "grep" && argument.includes("O"))
    return true;
  return false;
}
function safeEnvironment() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")));
  return {
    ...env,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0"
  };
}
async function requireDirectory(path) {
  if (!await isDirectory(path))
    throw directoryError(path);
}
async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
function directoryError(path) {
  return new GitError(`directory does not exist: ${path}`, null, "", "directory");
}
function executeGit(args, cwd, env, maxBuffer) {
  return new Promise((resolve, reject) => {
    const child = execFileCallback("git", args, { cwd, env, encoding: "utf8", maxBuffer }, (error, stdout, stderr) => {
      if (error) {
        const failure = error;
        failure.stdout = stdout;
        failure.stderr = stderr;
        reject(failure);
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.stdin?.end();
  });
}

// src/init/init.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// src/config/paths.ts
var CONFIG_DIR = ".agents/code-audit";
var RULE_DIRS = {
  policies: "policy",
  rules: "rule",
  business: "business",
  decisions: "decision",
  templates: "template"
};

// src/init/templates.ts
function projectTemplates(language) {
  const spanish = /^es(?:-|$)/i.test(language);
  const text = spanish ? ES : EN;
  const files = new Map([
    ["config.md", text.config.replace(/language: (?:en|es)/, `language: ${language}`)],
    ["project.md", text.project],
    ["structure.md", text.structure],
    ["README.md", text.overview],
    ["task-template.md", text.task],
    ["tasks/.gitkeep", ""],
    ["runs/.gitkeep", ""]
  ]);
  for (const folder of Object.keys(RULE_DIRS)) {
    files.set(`${folder}/README.md`, ruleReadme(folder, spanish, text.ruleBody[folder]));
  }
  return files;
}
function ruleReadme(folder, spanish, body) {
  const labels = spanish ? { policies: "Políticas", rules: "Reglas técnicas", business: "Reglas de negocio", decisions: "Decisiones de arquitectura", templates: "Plantillas" } : { policies: "Policies", rules: "Technical rules", business: "Business rules", decisions: "Architecture decisions", templates: "Templates" };
  const descriptions = spanish ? { policies: "Reglas para todo el proyecto; se leen siempre.", rules: "Reglas sobre tecnologías y prácticas técnicas.", business: "Reglas sobre términos y comportamiento del negocio.", decisions: "Decisiones de arquitectura y sus consecuencias.", templates: "Criterios para los componentes nuevos." } : { policies: "Rules for the whole project; always read.", rules: "Rules about technologies and technical practices.", business: "Rules about business terms and behavior.", decisions: "Architecture decisions and their consequences.", templates: "Criteria for new components." };
  const id = `EXAMPLE-${folder.toUpperCase()}`;
  const applies = folder === "policies" ? "" : `applies_to:
  - "src/**"
`;
  const title = spanish ? "Ejemplo completo de regla" : "Complete example rule";
  const example = `---
id: ${id}
title: ${title}
severity: minor
${applies}keywords: [example]
---
${body}`;
  const heading = labels[folder];
  const instructions = spanish ? ["# " + heading, "", descriptions[folder] + " Guarda cada regla en un archivo Markdown con encabezado YAML y cuerpo Markdown.", "", "Ejemplo completo de regla:", "", "```markdown", example, "```", ""].join(`
`) : ["# " + heading, "", descriptions[folder] + " Store each rule in a Markdown file with a YAML header and Markdown body.", "", "Complete rule example:", "", "```markdown", example, "```", ""].join(`
`);
  return instructions;
}
var EN = {
  config: `---
structure_version: 1
language: en
max_changed_lines: 1000
---
`,
  project: `# Project

Describe the project, its technologies, and business vocabulary.
`,
  structure: `# Project structure

Describe where components, services, and utilities live and the folder conventions.
`,
  overview: `# Code Audit configuration

This folder contains the team's project context and review rules.

- config.md: report language and review settings.
- project.md: project purpose, technologies, and vocabulary.
- structure.md: code locations and folder conventions.
- policies/: rules for the whole project; always read.
- rules/: technical rules.
- business/: business rules.
- decisions/: architecture decisions.
- templates/: expectations for new components.
- tasks/: task briefs, ignored by Git.
- runs/: review results, ignored by Git.

Folder and severity are separate: the folder gives the rule type; each rule declares severity. Rule headers use YAML with id, title, severity, optional applies_to, and optional keywords.

## How to fill a task brief

Copy task-template.md to tasks/PAY-123.md. Fill in the objective and numbered acceptance criteria; both are required. The tasks/ folder is ignored by Git, so task briefs are not committed to the repository.
`,
  task: `---
source: https://example.invalid/task
---
## Objective
Describe the desired outcome and why it matters.

## Acceptance criteria
1. Describe one verifiable result.

## Out of scope
Describe excluded work.

## Expected areas (optional)
List likely files or folders.

## Notes and decisions
Add relevant agreements or design links.
`,
  ruleBody: {
    policies: "Apply this requirement to every part of the project.",
    rules: "Keep this technical behavior consistent across the project.",
    business: "Use this business term and behavior consistently.",
    decisions: "Record the decision, its context, and its consequences.",
    templates: "Use this structure and quality bar for new components."
  }
};
var ES = {
  config: `---
structure_version: 1
language: es
max_changed_lines: 1000
---
`,
  project: `# Proyecto

Describe el proyecto, sus tecnologías y el vocabulario del negocio.
`,
  structure: `# Estructura del proyecto

Describe dónde viven los componentes, servicios y utilidades, y las convenciones de carpetas.
`,
  overview: `# Configuración de Code Audit

Esta carpeta contiene el contexto del proyecto y las reglas de revisión del equipo.

- config.md: idioma del informe y opciones de revisión.
- project.md: propósito, tecnologías y vocabulario.
- structure.md: ubicación del código y convenciones.
- policies/: reglas para todo el proyecto; se leen siempre.
- rules/: reglas técnicas.
- business/: reglas de negocio.
- decisions/: decisiones de arquitectura.
- templates/: expectativas para componentes nuevos.
- tasks/: fichas de tarea, ignoradas por Git.
- runs/: resultados de revisión, ignorados por Git.

La carpeta y la gravedad son distintas: la carpeta indica el tipo de regla y cada regla declara su gravedad. El encabezado YAML usa id, title, severity, applies_to opcional y keywords opcional.

## Cómo llenar una ficha de tarea

Copia task-template.md a tasks/PAY-123.md. Llena el objetivo y los criterios de aceptación numerados; ambos son obligatorios. La carpeta tasks/ está excluida de Git, así que las fichas no se suben al repositorio.
`,
  task: `---
source: https://example.invalid/tarea
---
## Objetivo
Describe el resultado deseado y por qué importa.

## Criterios de aceptación
1. Describe un resultado que se pueda comprobar.

## Fuera de alcance
Describe el trabajo excluido.

## Áreas que se espera tocar (opcional)
Enumera archivos o carpetas probables.

## Notas y decisiones
Agrega acuerdos o enlaces de diseño relevantes.
`,
  ruleBody: {
    policies: "Aplica este requisito en todas las partes del proyecto.",
    rules: "Mantén este comportamiento técnico consistente en el proyecto.",
    business: "Usa este término y comportamiento de negocio de forma consistente.",
    decisions: "Registra la decisión, su contexto y sus consecuencias.",
    templates: "Usa esta estructura y nivel de calidad para componentes nuevos."
  }
};

// src/init/init.ts
class InvalidLanguageError extends Error {
  constructor(language) {
    super(`invalid language: ${language}`);
    this.name = "InvalidLanguageError";
  }
}
async function initProject(root, opts) {
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(opts.language)) {
    throw new InvalidLanguageError(opts.language);
  }
  const repoRoot = await findRepoRoot(root);
  const created = [];
  const skipped = [];
  for (const [file, content] of projectTemplates(opts.language)) {
    const relative = `${CONFIG_DIR}/${file}`;
    const absolute = join(repoRoot, relative);
    await mkdir(join(absolute, ".."), { recursive: true });
    try {
      await writeFile(absolute, content, { flag: "wx" });
      created.push(relative);
    } catch (error) {
      if (error.code !== "EEXIST")
        throw error;
      skipped.push(relative);
    }
  }
  const gitignoreUpdated = await updateGitignore(repoRoot);
  return { created, skipped, gitignoreUpdated };
}
async function updateGitignore(root) {
  const path = join(root, ".gitignore");
  let content;
  let exists = true;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
    exists = false;
    content = "";
  }
  const newline = content.includes(`\r
`) ? `\r
` : `
`;
  const existing = new Set(content.split(/\r?\n/).map(normalizeGitignoreLine));
  const missing = GITIGNORE_LINES.filter((line) => !existing.has(normalizeGitignoreLine(line)));
  if (missing.length === 0)
    return false;
  const prefix = content.length > 0 && !content.endsWith(`
`) ? newline : "";
  const additions = `${prefix}${missing.join(newline)}${newline}`;
  await writeFile(path, additions, { flag: exists ? "a" : "wx" });
  return true;
}
function normalizeGitignoreLine(line) {
  return line.trim().replace(/^\/+|\/+$/g, "");
}
var GITIGNORE_LINES = [".agents/code-audit/tasks/", ".agents/code-audit/runs/"];
// package.json
var package_default = {
  name: "code-audit",
  version: "0.1.0",
  private: true,
  type: "module",
  scripts: {
    build: "bun scripts/build.ts",
    test: "bun test",
    typecheck: "tsc --noEmit",
    "docs:check": "bun scripts/check-docs.ts"
  },
  devDependencies: {
    "@types/bun": "^1.4.2",
    "@types/node": "^26.6.5",
    typescript: "^5.9.3"
  },
  dependencies: {
    yaml: "^2.9.1"
  }
};

// src/version.ts
var VERSION = package_default.version;

// src/cli.ts
var HELP = `code-audit ${VERSION}

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
  --version           Show the version`;
var COMMANDS = new Set(["init", "check", "review"]);
async function main(argv, io = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s)
}) {
  if (argv.length === 1 && argv[0] === "--version") {
    io.stdout(`${VERSION}
`);
    return ExitCode.OK;
  }
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    io.stdout(`${HELP}
`);
    return ExitCode.OK;
  }
  const [command, ...options] = argv;
  if (!command || command.startsWith("-") || !COMMANDS.has(command)) {
    io.stderr(`Unknown command: ${command ?? ""}
`);
    return ExitCode.USAGE;
  }
  for (let index = 0;index < options.length; index += 1) {
    const option = options[index];
    if (option === "--json")
      continue;
    if (option === "--root" || option === "--language") {
      if (!options[index + 1] || options[index + 1].startsWith("--")) {
        io.stderr(`Missing value for ${option}
`);
        return ExitCode.USAGE;
      }
      index += 1;
      continue;
    }
    if (option === "--help" || option === "-h") {
      io.stdout(`${HELP}
`);
      return ExitCode.OK;
    }
    io.stderr(`Unknown option: ${option}
`);
    return ExitCode.USAGE;
  }
  if (command === "init") {
    let root = process.cwd();
    let language = "en";
    let json = false;
    for (let index = 0;index < options.length; index += 1) {
      const option = options[index];
      if (option === "--json")
        json = true;
      else if (option === "--root")
        root = options[++index];
      else if (option === "--language")
        language = options[++index];
    }
    try {
      const result = await initProject(root, { language });
      io.stdout(json ? `${JSON.stringify(result)}
` : formatInitResult(result));
      return ExitCode.OK;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof InvalidLanguageError) {
        io.stderr(`${message}
`);
        return ExitCode.USAGE;
      }
      if (error instanceof NotARepoError) {
        io.stderr(`${message}
`);
        return ExitCode.NOT_A_REPO;
      }
      io.stderr(`init failed: ${message}
`);
      return ExitCode.INTERNAL;
    }
  }
  if (command === "review") {
    io.stderr(`review is not available yet
`);
    return ExitCode.USAGE;
  }
  io.stderr(`${command} is not available yet
`);
  return ExitCode.USAGE;
}
function formatInitResult(result) {
  const lines = [`Created ${result.created.length} file(s).`, `Skipped ${result.skipped.length} existing file(s).`];
  if (result.gitignoreUpdated)
    lines.push("Updated .gitignore.");
  else
    lines.push(".gitignore already contains the required entries.");
  return `${lines.join(`
`)}
`;
}

// src/bin.ts
try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}
`);
  process.exitCode = ExitCode.INTERNAL;
}
