/** Stable process exit codes returned by the command line interface. */
export const ExitCode = {
  OK: 0,
  USAGE: 1,
  CONFIG_INVALID: 2,
  NOT_A_REPO: 3,
  INTERNAL: 10,
} as const;
