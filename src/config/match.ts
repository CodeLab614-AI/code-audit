import picomatch from 'picomatch';

/**
 * Creates a matcher function returning the first glob pattern that matches a given file path.
 *
 * Patterns are evaluated with dotfile support enabled. Malformed patterns never match.
 */
export function createMatcher(patterns: string[]): (file: string) => string | undefined {
  const matchers = patterns.map((pattern) => {
    try {
      const match = picomatch(pattern, { dot: true });
      return { pattern, match };
    } catch {
      return { pattern, match: () => false };
    }
  });

  return (file: string): string | undefined => {
    for (const { pattern, match } of matchers) {
      try {
        if (match(file)) return pattern;
      } catch {
        // Ignore runtime matching errors for malformed inputs.
      }
    }
    return undefined;
  };
}
