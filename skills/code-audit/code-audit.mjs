#!/usr/bin/env node

// src/exit-codes.ts
var ExitCode = {
  OK: 0,
  USAGE: 1,
  CONFIG_INVALID: 2,
  NOT_A_REPO: 3,
  INTERNAL: 10
};
// package.json
var package_default = {
  name: "code-audit",
  version: "0.1.0",
  private: true,
  type: "module",
  scripts: {
    build: "bun scripts/build.ts",
    test: "bun test",
    typecheck: "tsc --noEmit"
  },
  devDependencies: {
    "@types/bun": "^1.4.2",
    "@types/node": "^26.6.5",
    typescript: "^5.9.3"
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
  if (command === "review") {
    io.stderr(`review is not available yet
`);
    return ExitCode.USAGE;
  }
  io.stderr(`${command} is not available yet
`);
  return ExitCode.USAGE;
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
