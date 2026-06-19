/**
 * Shared types for the autodocs extension.
 */

/**
 * Per-project docs configuration stored in the global settings file.
 * Keyed by absolute project directory path.
 */
export interface AutodocsEntry {
  /** Relative path to the docs directory, e.g. "docs". */
  docsPath: string;
}

/** Global settings file: project dir path -> entry. */
export type AutodocsConfig = Record<string, AutodocsEntry>;

/** Result of the check subagent: a docs-keeping recommendation. */
export interface DocsCheckResult {
  needsUpdate: boolean;
  /** One-paragraph plain-English summary of the drift and what to change. */
  brief: string;
  /** Suggested doc targets with an operation. */
  targets: DocsTarget[];
}

export interface DocsTarget {
  /** Repo-relative path, e.g. "docs/extensions/autodocs.md". */
  path: string;
  op: "create" | "update" | "archive";
  /** Optional line hint / rationale. */
  hint?: string;
}

/** Git advancement range captured after a main-advancing git op. */
export interface GitAdvancement {
  fromSha: string;
  toSha: string;
  /** Number of commits in from..to. */
  commits: number;
  /** Insertions (+). */
  additions: number;
  /** Deletions (-). */
  deletions: number;
}

/** Pre-command SHA snapshot stashed on tool_call, consumed on tool_result. */
export interface StashedSha {
  cwd: string;
  mainBranch: string;
  fromSha: string;
}

/** Result of the confirmation gate shown after a drift check. */
export type GateResult = "accept" | "skip";

/** Result of the plan dialog shown by /docs:update and /docs:setup. */
export type PlanResult = "apply" | "cancel";

/** Details carried by the injected "autodocs-suggestion" custom message. */
export interface AutodocsSuggestionDetails {
  fromSha: string;
  toSha: string;
  brief: string;
  targets: DocsTarget[];
}

export const AUTODOCS_SUGGESTION_TYPE = "autodocs-suggestion";
