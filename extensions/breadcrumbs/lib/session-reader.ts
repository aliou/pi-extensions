/**
 * Session reader for parsing and querying session JSONL files.
 *
 * Provides utilities to load sessions and create tools the subagent can use
 * to extract information from sessions without seeing the raw JSONL.
 */

import { readFileSync } from "node:fs";
import type {
  AssistantMessage,
  TextContent,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "@earendil-works/pi-ai";
import type {
  AgentToolResult,
  CompactionEntry as PiCompactionEntry,
  SessionEntry,
  SessionHeader,
  SessionMessageEntry,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { parseSessionEntries as parseSessionEntriesImpl } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// Re-export types for backward compatibility
export type {
  SessionEntry,
  SessionHeader,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

/**
 * Tool call extracted from assistant message.
 */
export interface ExtractedToolCall {
  id: string;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timestamp: string;
}

/**
 * Tool result entry from session.
 */
export interface ExtractedToolResult {
  id: string;
  toolCallId: string;
  toolName: string;
  content: string;
  isError: boolean;
  timestamp: string;
}

/**
 * Parsed session with extracted data.
 */
export interface ParsedSession {
  header: SessionHeader;
  entries: SessionEntry[];
  messages: SessionMessageEntry[];
  toolCalls: ExtractedToolCall[];
  toolResults: ExtractedToolResult[];
  compactions: PiCompactionEntry[];
  sessionName: string;
}

/**
 * Extract text content from message content field with proper type handling.
 */
function extractTextFromContent(
  content: string | (TextContent | { type: string; text?: string })[],
): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (c): c is TextContent =>
          typeof c === "object" && c !== null && c.type === "text",
      )
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

/**
 * Load and parse a session file.
 */
export function loadSession(sessionPath: string): ParsedSession {
  const content = readFileSync(sessionPath, "utf-8");
  const fileEntries = parseSessionEntriesImpl(content);

  if (fileEntries.length === 0) {
    throw new Error("Empty session file");
  }

  const first = fileEntries[0];
  if (!first || first.type !== "session") {
    throw new Error("Invalid session file: missing header");
  }
  const header = first as SessionHeader;

  // Separate entries (everything after header)
  const entries = fileEntries.slice(1) as SessionEntry[];

  // Extract typed data
  const messages: SessionMessageEntry[] = [];
  const toolCallsMap = new Map<string, ExtractedToolCall>();
  const toolResults: ExtractedToolResult[] = [];
  const compactions: PiCompactionEntry[] = [];
  let sessionName = "Untitled";

  for (const entry of entries) {
    // Extract messages
    if (entry.type === "message") {
      const msgEntry = entry as SessionMessageEntry;
      messages.push(msgEntry);

      // Extract tool calls from assistant messages
      if (msgEntry.message.role === "assistant") {
        const assistantMsg = msgEntry.message as AssistantMessage;
        for (const block of assistantMsg.content) {
          if (block.type === "toolCall") {
            const tc = block as ToolCall;
            const extracted: ExtractedToolCall = {
              id: msgEntry.id,
              toolCallId: tc.id,
              toolName: tc.name,
              arguments: tc.arguments,
              timestamp: msgEntry.timestamp,
            };
            toolCallsMap.set(tc.id, extracted);
          }
        }
      }

      // Extract tool results
      if (msgEntry.message.role === "toolResult") {
        const trMsg = msgEntry.message as ToolResultMessage;
        const toolName =
          toolCallsMap.get(trMsg.toolCallId)?.toolName || trMsg.toolName;

        // Extract text from content
        const contentText = extractTextFromContent(trMsg.content);

        const result: ExtractedToolResult = {
          id: msgEntry.id,
          toolCallId: trMsg.toolCallId,
          toolName,
          content: contentText,
          isError: trMsg.isError,
          timestamp: msgEntry.timestamp,
        };
        toolResults.push(result);
      }
    }

    // Extract compactions
    if (entry.type === "compaction") {
      const compactionEntry = entry as PiCompactionEntry;
      compactions.push(compactionEntry);
    }

    // Extract session name
    if (entry.type === "session_info") {
      const sessionInfoEntry = entry as { type: "session_info"; name: string };
      if (sessionInfoEntry.name) {
        sessionName = sessionInfoEntry.name;
      }
    }
  }

  return {
    header,
    entries,
    messages,
    toolCalls: Array.from(toolCallsMap.values()),
    toolResults,
    compactions,
    sessionName,
  };
}

/**
 * Enforce a character limit on serialized items.
 * Returns what fits + truncated flag.
 */
function enforceCharLimit(
  items: unknown[],
  limit: number,
): { items: unknown[]; truncated: boolean } {
  const result: unknown[] = [];
  let totalChars = 0;

  for (const item of items) {
    const serialized = JSON.stringify(item);
    if (totalChars + serialized.length > limit) {
      return { items: result, truncated: true };
    }
    result.push(item);
    totalChars += serialized.length;
  }

  return { items: result, truncated: false };
}

/**
 * Create tools for the subagent to query a session.
 */
export function createSessionTools(session: ParsedSession): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Tool 1: get_session_overview
  tools.push({
    name: "get_session_overview",
    label: "Get Session Overview",
    description: "Get an overview of the session",
    parameters: Type.Object({}),
    async execute(): Promise<AgentToolResult<unknown>> {
      const toolNames = Array.from(
        new Set(session.toolCalls.map((tc) => tc.toolName)),
      ).sort();

      const result = {
        id: session.header.id,
        cwd: session.header.cwd,
        name: session.sessionName,
        created: session.header.timestamp,
        messageCount: session.messages.length,
        compactionCount: session.compactions.length,
        latestCompactionSummary:
          session.compactions.length > 0
            ? (
                session.compactions[session.compactions.length - 1]?.summary ??
                ""
              ).slice(0, 2000)
            : null,
        parentSessionPath: session.header.parentSession || null,
        toolNames,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: {},
      };
    },
  });

  // Tool 2: get_messages
  tools.push({
    name: "get_messages",
    label: "Get Messages",
    description: "Get messages from the session",
    parameters: Type.Object({
      offset: Type.Optional(Type.Number()),
      limit: Type.Optional(Type.Number()),
      role: Type.Optional(
        Type.Union([Type.Literal("user"), Type.Literal("assistant")]),
      ),
    }),
    async execute(
      _toolCallId: string,
      args: Record<string, unknown>,
    ): Promise<AgentToolResult<unknown>> {
      const offset = Number(args.offset ?? 0);
      const limit = Math.min(Number(args.limit ?? 20), 50);
      const role = args.role as "user" | "assistant" | undefined;

      let filtered = session.messages;
      if (role) {
        filtered = filtered.filter((m) => m.message.role === role);
      }

      const sliced = filtered.slice(offset, offset + limit);

      const items = sliced.map((m) => {
        let content = "";
        if (m.message.role === "user") {
          const userMsg = m.message as UserMessage;
          content = extractTextFromContent(userMsg.content);
        } else if (m.message.role === "assistant") {
          const assistantMsg = m.message as AssistantMessage;
          const textBlocks = assistantMsg.content.filter(
            (b): b is TextContent => b.type === "text",
          );
          content = textBlocks.map((b) => b.text).join("\n");
        }
        return {
          id: m.id,
          role: m.message.role,
          timestamp: m.timestamp,
          content,
        };
      });

      const { items: capped, truncated } = enforceCharLimit(items, 50000);

      const result = {
        messages: capped,
        truncated,
        totalCount: filtered.length,
        offset,
        limit,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: {},
      };
    },
  });

  // Tool 3: get_tool_calls
  tools.push({
    name: "get_tool_calls",
    label: "Get Tool Calls",
    description: "Get tool calls made in the session",
    parameters: Type.Object({
      toolName: Type.String(),
      offset: Type.Optional(Type.Number()),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(
      _toolCallId: string,
      args: Record<string, unknown>,
    ): Promise<AgentToolResult<unknown>> {
      const toolName = String(args.toolName ?? "");
      const offset = Number(args.offset ?? 0);
      const limit = Math.min(Number(args.limit ?? 20), 50);

      const filtered = session.toolCalls.filter(
        (tc) => tc.toolName === toolName,
      );
      const sliced = filtered.slice(offset, offset + limit);

      const items = sliced.map((tc) => ({
        id: tc.id,
        toolName: tc.toolName,
        arguments: tc.arguments,
        timestamp: tc.timestamp,
      }));

      const { items: capped, truncated } = enforceCharLimit(items, 50000);

      const result = {
        toolCalls: capped,
        truncated,
        totalCount: filtered.length,
        offset,
        limit,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: {},
      };
    },
  });

  // Tool 4: get_tool_results
  tools.push({
    name: "get_tool_results",
    label: "Get Tool Results",
    description: "Get tool results from the session",
    parameters: Type.Object({
      toolName: Type.String(),
      offset: Type.Optional(Type.Number()),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(
      _toolCallId: string,
      args: Record<string, unknown>,
    ): Promise<AgentToolResult<unknown>> {
      const toolName = String(args.toolName ?? "");
      const offset = Number(args.offset ?? 0);
      const limit = Math.min(Number(args.limit ?? 20), 50);

      const filtered = session.toolResults.filter(
        (tr) => tr.toolName === toolName,
      );
      const sliced = filtered.slice(offset, offset + limit);

      const items = sliced.map((tr) => ({
        id: tr.id,
        toolName: tr.toolName,
        content: tr.content,
        isError: tr.isError,
        timestamp: tr.timestamp,
      }));

      const { items: capped, truncated } = enforceCharLimit(items, 50000);

      const result = {
        toolResults: capped,
        truncated,
        totalCount: filtered.length,
        offset,
        limit,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: {},
      };
    },
  });

  // Tool 5: get_compactions
  tools.push({
    name: "get_compactions",
    label: "Get Compactions",
    description: "Get session compactions",
    parameters: Type.Object({
      offset: Type.Optional(Type.Number()),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(
      _toolCallId: string,
      args: Record<string, unknown>,
    ): Promise<AgentToolResult<unknown>> {
      const offset = Number(args.offset ?? 0);
      const limit = Number(args.limit ?? 10);

      const sliced = session.compactions.slice(offset, offset + limit);

      const items = sliced.map((c) => ({
        id: c.id,
        summary: c.summary,
        timestamp: c.timestamp,
        tokensBefore: c.tokensBefore,
      }));

      const { items: capped, truncated } = enforceCharLimit(items, 50000);

      const result = {
        compactions: capped,
        truncated,
        totalCount: session.compactions.length,
        offset,
        limit,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: {},
      };
    },
  });

  // Tool 6: find_messages
  tools.push({
    name: "find_messages",
    label: "Find Messages",
    description: "Find messages by substring search",
    parameters: Type.Object({
      query: Type.String(),
      role: Type.Optional(
        Type.Union([Type.Literal("user"), Type.Literal("assistant")]),
      ),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(
      _toolCallId: string,
      args: Record<string, unknown>,
    ): Promise<AgentToolResult<unknown>> {
      const query = String(args.query ?? "").toLowerCase();
      const role = args.role as "user" | "assistant" | undefined;
      const limit = Math.min(Number(args.limit ?? 10), 20);

      if (!query) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ messages: [], truncated: false }),
            },
          ],
          details: {},
        };
      }

      let filtered = session.messages;
      if (role) {
        filtered = filtered.filter((m) => m.message.role === role);
      }

      const results = [];
      for (const msg of filtered) {
        let content = "";
        if (msg.message.role === "user") {
          const userMsg = msg.message as UserMessage;
          content = extractTextFromContent(userMsg.content);
        } else if (msg.message.role === "assistant") {
          const assistantMsg = msg.message as AssistantMessage;
          const textBlocks = assistantMsg.content.filter(
            (b): b is TextContent => b.type === "text",
          );
          content = textBlocks.map((b) => b.text).join("\n");
        }

        const lowerContent = content.toLowerCase();

        if (lowerContent.includes(query)) {
          const idx = lowerContent.indexOf(query);
          const start = Math.max(0, idx - 100);
          const end = Math.min(content.length, idx + 100);
          const snippet = content.slice(start, end);

          results.push({
            id: msg.id,
            role: msg.message.role,
            timestamp: msg.timestamp,
            snippet,
          });

          if (results.length >= limit) {
            break;
          }
        }
      }

      const result = {
        messages: results,
        truncated: false,
        count: results.length,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: {},
      };
    },
  });

  return tools;
}
