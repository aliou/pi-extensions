import type { AgentTool, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import type { Skill, ToolDefinition } from "@mariozechner/pi-coding-agent";

/**
 * Configuration for a subagent.
 * No ToolPolicy abstraction - just pass tools directly.
 */
export interface SubagentConfig {
  /** Subagent name (for logging and run ID) */
  name: string;

  /** Model instance to use */
  // biome-ignore lint/suspicious/noExplicitAny: Model type requires any for generic API
  model: Model<any>;

  /** System prompt for the subagent */
  systemPrompt: string;

  /** Built-in tools (AgentTool[]) - e.g., from createReadOnlyTools() */
  tools?: AgentTool[];

  /** Custom tools (ToolDefinition[]) - e.g., GitHub tools */
  customTools?: ToolDefinition[];

  /** Skills to load into system prompt */
  skills?: Skill[];

  /** Extension paths to load (filesystem, npm:, or git URLs). Resolved by DefaultResourceLoader. */
  extensionPaths?: string[];

  /** Thinking level. Default: "low" */
  thinkingLevel?: ThinkingLevel;

  /** Logging options */
  logging?: {
    /** Enable logging. Default: false */
    enabled: boolean;
    /** Include raw events in debug.jsonl. Default: false */
    debug?: boolean;
  };
}

export type ToolCostCurrency = "USD" | "EUR";

export interface SubagentToolResultDetails {
  provider?: string;
  cost?: number;
  costCurrency?: ToolCostCurrency;
  [key: string]: unknown;
}

export interface SubagentToolResultObject {
  content?: Array<{ type: string; text?: string }>;
  details?: SubagentToolResultDetails;
  [key: string]: unknown;
}

export type SubagentToolResultValue =
  | SubagentToolResultObject
  | string
  | number
  | boolean
  | null
  | Array<unknown>;

/**
 * Tool call state for tracking subagent tool executions.
 */
export interface SubagentToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  /** Epoch ms when tool execution started */
  startedAt?: number;
  /** Epoch ms when tool execution ended */
  endedAt?: number;
  /** Duration in milliseconds (set when ended) */
  durationMs?: number;
  result?: SubagentToolResultValue;
  error?: string;
  /** Partial result from tool updates (for progress display) */
  partialResult?: {
    content: Array<{ type: string; text?: string }>;
    details?: unknown;
  };
}

/**
 * Usage/cost information from the model response.
 */
export interface SubagentUsage {
  /** Input tokens from API (if available) */
  inputTokens?: number;
  /** Output tokens from API (if available) */
  outputTokens?: number;
  /** Cache read tokens (if available) */
  cacheReadTokens?: number;
  /** Cache write tokens (if available) */
  cacheWriteTokens?: number;
  /** Estimated tokens from response length (chars/4) */
  estimatedTokens: number;
  /** LLM cost in USD (if available) */
  llmCost?: number;
  /** Tool cost in USD */
  toolCostUsd?: number;
  /** Tool cost in EUR */
  toolCostEur?: number;
  /** Total USD side cost (llmCost + toolCostUsd) */
  totalCostUsd?: number;
}

/**
 * Result from executing a subagent.
 */
export interface SubagentResult {
  /** Final text content from the subagent */
  content: string;

  /** Whether the subagent was aborted */
  aborted: boolean;

  /** Final tool call states */
  toolCalls: SubagentToolCall[];

  /** Total subagent execution duration in milliseconds */
  totalDurationMs: number;

  /** Error message if the subagent failed */
  error?: string;

  /** Final stop reason from the assistant turn (if available) */
  stopReason?: string;

  /** Provider-level error message from the assistant turn (if available) */
  providerErrorMessage?: string;

  /** Unique run identifier */
  runId: string;

  /** Log file paths (if logging enabled) */
  logFiles?: {
    stream: string; // Human-readable log
    debug: string; // JSONL raw events
  };

  /** Usage/cost information */
  usage: SubagentUsage;
}

/** Callback for text streaming updates */
export type OnTextUpdate = (delta: string, accumulated: string) => void;

/** Callback for tool execution updates */
export type OnToolUpdate = (toolCalls: SubagentToolCall[]) => void;

/** Safe helper for extracting typed details from a tool result value. */
export function getToolResultDetails(
  result: SubagentToolResultValue | undefined,
): SubagentToolResultDetails | undefined {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return undefined;
  }

  const details = (result as { details?: unknown }).details;
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  return details as SubagentToolResultDetails;
}

// ---------------------------------------------------------------------------
// Shared detail interfaces - composed into BaseSubagentDetails
// ---------------------------------------------------------------------------

/** Skill resolution state for rendering */
export interface SubagentSkillDetails {
  /** Requested skill names (from input) */
  skills?: string[];
  /** Number of skills successfully resolved */
  skillsResolved?: number;
  /** Skill names that were not found */
  skillsNotFound?: string[];
}

/** Tool call tracking state for rendering */
export interface SubagentToolCallDetails {
  /** Tool calls made by the subagent */
  toolCalls: SubagentToolCall[];
}

/** Response / completion state for rendering */
export interface SubagentResponseDetails {
  /** The subagent's final response */
  response?: string;
  /** Whether the request was aborted */
  aborted?: boolean;
  /** Error message if failed */
  error?: string;
  /** Usage stats from the subagent */
  usage?: SubagentUsage;
  /** Resolved model used for this run (provider + model id) */
  resolvedModel?: { provider: string; id: string };
  /** Total subagent execution duration in milliseconds */
  totalDurationMs?: number;
}

/**
 * Base details shared by all subagent tool renderers.
 *
 * Each subagent's Details type extends this with its own input-specific fields.
 */
export interface BaseSubagentDetails
  extends SubagentSkillDetails,
    SubagentToolCallDetails,
    SubagentResponseDetails {
  /** Tool call ID used as cache key for render component reuse */
  _renderKey?: string;
}
