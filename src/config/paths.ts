// Keep one canonical path for configuration files and diagnostics.
/** Names the project-local Code Audit configuration directory. */
export const CONFIG_DIR = '.agents/code-audit';

// Folder names are plural on disk; values are singular in Rule.kind.
/** Maps rule folders to the kind recorded in each loaded rule. */
export const RULE_DIRS = {
  policies: 'policy',
  rules: 'rule',
  business: 'business',
  decisions: 'decision',
  templates: 'template',
} as const;
