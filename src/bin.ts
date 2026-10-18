import { main } from './cli.js';
import { ExitCode } from './exit-codes.js';

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = ExitCode.INTERNAL;
}
