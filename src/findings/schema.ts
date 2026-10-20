import type { Severity } from '../config/types.js';

/** Expected schema version for findings files. */
export const FINDINGS_SCHEMA_VERSION = 1;

/** Represents a single validated and normalized review finding. */
export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  file: string;
  quote: string;
  impact: string;
  verified: boolean;
  wholeFile: boolean;
  line?: number;
  endLine?: number;
  suggestion?: { startLine: number; code: string };
  ruleId?: string;
  relatedFindings: string[];
  relatedCriteria: number[];
  relatedNote?: string;
  existing?: { file: string; line?: number; note: string };
}

/** Describes the evaluation status and reason for one task criterion. */
export interface CriterionResult {
  number: number;
  text: string;
  status: 'met' | 'partial' | 'not_met' | 'not_evaluated';
  reason?: string;
}

/** Identifies an unrequested modification considered out of scope. */
export interface OutOfScope {
  file: string;
  line?: number;
  note: string;
}

/** Describes a suggested new rule proposed by a review session. */
export interface SuggestedRule {
  text: string;
  fromFinding?: string;
}

/** Records an unverified or discarded finding and the reason for rejection. */
export interface DiscardedFinding {
  id: string;
  title: string;
  reason: string;
}

/** Normalized and validated findings dataset produced from findings input. */
export interface FindingsData {
  schemaVersion: 1;
  summary: string;
  criteria: CriterionResult[];
  findings: Finding[];
  outOfScope: OutOfScope[];
  ideas: string[];
  suggestedRules: SuggestedRule[];
  impact: string[];
  discarded: DiscardedFinding[];
}
