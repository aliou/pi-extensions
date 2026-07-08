import * as fs from "node:fs";
import {
  type FileEntry,
  parseSessionEntries,
  type SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

export interface Transcript {
  /** First user message text, if any. */
  input?: string;
  /** Last assistant message text, if any. */
  output?: string;
  /** Last tool result text, if the subagent ended with a tool call. */
  toolResult?: string;
  /** Output tokens from the last assistant message's usage, if available. */
  outputTokens?: number;
  /** Input tokens from the last assistant message's usage, if available. */
  inputTokens?: number;
  /** Total cost from the last assistant message's usage, if available. */
  cost?: number;
  /** Number of tool result entries in the session. */
  toolCalls?: number;
  /** Session duration in milliseconds (first to last message). */
  durationMs?: number;
}

/**
 * Read a subagent's input/output from its session file, best-effort.
 *
 * Returns `undefined` when the file is missing, unreadable, pruned, or
 * contains no usable messages. Never throws.
 */
export function readSubagentTranscript(
  sessionFile: string,
): Transcript | undefined {
  let content: string;
  try {
    content = fs.readFileSync(sessionFile, "utf8");
  } catch {
    return undefined;
  }
  return parseSubagentTranscript(content);
}

/**
 * Parse a session file's contents into a transcript plus stats.
 *
 * - `input`: text of the first entry whose message role is `user`.
 * - `output`: text of the last entry whose message role is `assistant`,
 *   skipping pure-thinking blocks.
 * - `toolResult`: text of the last `toolResult` entry (useful when the
 *   subagent's value is a tool call, e.g. `session_name`).
 * - Token/cost stats come from the last assistant message's `usage`.
 *
 * Returns `undefined` when no input, output, or tool result is available.
 */
export function parseSubagentTranscript(
  content: string,
): Transcript | undefined {
  let entries: FileEntry[];
  try {
    entries = parseSessionEntries(content);
  } catch {
    return undefined;
  }

  let input: string | undefined;
  let output: string | undefined;
  let toolResult: string | undefined;
  let outputTokens: number | undefined;
  let inputTokens: number | undefined;
  let cost: number | undefined;
  let toolCalls = 0;
  let firstTs: number | undefined;
  let lastTs: number | undefined;

  for (const entry of entries) {
    if (!isMessageEntry(entry)) continue;
    const message = entry.message;

    const ts = Date.parse(entry.timestamp);
    if (!Number.isNaN(ts)) {
      if (firstTs === undefined) firstTs = ts;
      lastTs = ts;
    }

    if (message.role === "user" && input === undefined) {
      const text = messageToText(entry);
      if (text) input = text;
    }

    if (message.role === "assistant") {
      const text = messageToText(entry);
      if (text) {
        output = text;
        outputTokens = usageOutputTokens(message);
        inputTokens = usageInputTokens(message);
        cost = usageCost(message);
      }
    }

    if (message.role === "toolResult") {
      toolCalls += 1;
      const text = toolResultToText(message);
      if (text) toolResult = text;
    }
  }

  const hasContent = input || output || toolResult;
  if (!hasContent) return undefined;

  const durationMs =
    firstTs !== undefined && lastTs !== undefined
      ? lastTs - firstTs
      : undefined;

  return {
    input,
    output,
    toolResult,
    outputTokens,
    inputTokens,
    cost,
    toolCalls,
    durationMs,
  };
}

function isMessageEntry(entry: FileEntry): entry is SessionMessageEntry {
  return "type" in entry && entry.type === "message" && "message" in entry;
}

/** Flatten an assistant/user message's content blocks to plain text. */
function messageToText(entry: SessionMessageEntry): string | undefined {
  const message = entry.message;
  if (!(message.role === "assistant" || message.role === "user"))
    return undefined;
  if (!("content" in message)) return undefined;
  const content = message.content;
  if (typeof content === "string") return content || undefined;
  if (!Array.isArray(content)) return undefined;

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  const joined = parts.join("\n").trim();
  return joined.length > 0 ? joined : undefined;
}

function toolResultToText(
  message: SessionMessageEntry["message"],
): string | undefined {
  if (!("content" in message)) return undefined;
  const content = message.content;
  if (typeof content === "string") return content || undefined;
  if (!Array.isArray(content)) return undefined;

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  const joined = parts.join("\n").trim();
  return joined.length > 0 ? joined : undefined;
}

function usageOutputTokens(message: {
  role: string;
  usage?: { output?: number };
}): number | undefined {
  if (!("usage" in message)) return undefined;
  const usage = message.usage;
  if (!usage || typeof usage.output !== "number") return undefined;
  return usage.output;
}

function usageInputTokens(message: {
  role: string;
  usage?: { input?: number };
}): number | undefined {
  if (!("usage" in message)) return undefined;
  const usage = message.usage;
  if (!usage || typeof usage.input !== "number") return undefined;
  return usage.input;
}

function usageCost(message: {
  role: string;
  usage?: { cost?: { total?: number } };
}): number | undefined {
  if (!("usage" in message)) return undefined;
  const usage = message.usage;
  if (!usage || typeof usage.cost !== "object" || !usage.cost) return undefined;
  const total = usage.cost.total;
  if (typeof total !== "number") return undefined;
  return total;
}
