import { describe, expect, it } from 'bun:test';
import { main } from '../src/cli.js';
import { VERSION } from '../src/version.js';
import { ExitCode } from '../src/exit-codes.js';

describe('CLI', () => {
  it('prints the version and returns success', async () => {
    const stdout: string[] = [];
    const code = await main(['--version'], { stdout: (s) => stdout.push(s), stderr: () => {} });

    expect(code).toBe(ExitCode.OK);
    expect(stdout.join('')).toContain(VERSION);
  });

  it('prints help with the available commands', async () => {
    const stdout: string[] = [];
    const code = await main(['--help'], { stdout: (s) => stdout.push(s), stderr: () => {} });

    expect(code).toBe(ExitCode.OK);
    expect(stdout.join('')).toContain('init');
    expect(stdout.join('')).toContain('check');
    expect(stdout.join('')).toContain('review');
  });

  it('rejects unknown commands', async () => {
    const stderr: string[] = [];
    const code = await main(['nope'], { stdout: () => {}, stderr: (s) => stderr.push(s) });

    expect(code).toBe(ExitCode.USAGE);
    expect(stderr.join('')).toContain('Unknown command: nope');
  });

  it('reports that review is not available yet', async () => {
    const stderr: string[] = [];
    const code = await main(['review'], { stdout: () => {}, stderr: (s) => stderr.push(s) });

    expect(code).toBe(ExitCode.USAGE);
    expect(stderr.join('')).toContain('review is not available yet');
  });
});
