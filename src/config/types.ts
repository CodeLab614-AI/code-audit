// These are the normalized values returned by the rule loader.
/** Lists the supported rule severities. */
export type Severity = 'critical' | 'major' | 'minor';

// The loader derives this category from the source folder.
/** Lists the kinds inferred from rule directory names. */
export type RuleKind = 'policy' | 'rule' | 'business' | 'decision' | 'template';

// Each item identifies one source location and one diagnostic.
/** Describes a configuration or rule loading issue. */
export interface Problem {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

// Optional YAML values become explicit normalized properties here.
/** Stores normalized project configuration values. */
export interface Config {
  structureVersion: 1;
  language: string;
  baseBranch?: string;
  ignore: string[];
  maxChangedLines: number;
}

// A Rule combines normalized metadata with its Markdown body.
/** Stores one validated rule and its Markdown body. */
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
