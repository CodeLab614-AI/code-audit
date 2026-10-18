import packageJson from '../package.json' with { type: 'json' };

/** Package version embedded in the command line interface. */
export const VERSION: string = packageJson.version;
