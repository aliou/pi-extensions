/**
 * List Sessions tool - list sessions for a given directory.
 *
 * Reads session files from the encoded cwd directory under the Pi sessions root
 * and extracts metadata (id, name, message count) from each file.
 */

import { ToolBody, ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "typebox";
import { listSessions, type SessionListResult } from "../../lib/session-search";

const ListSessionsParams = Type.Object({
  cwd: Type.String({
    description: "Directory to list sessions for",
  }),
  limit: Type.Optional(
    Type.Integer({
      description: "Maximum number of sessions to return (default: 20)",
      minimum: 1,
      maximum: 100,
    }),
  ),
  depth: Type.Optional(
    Type.Integer({
      description:
        "How many levels of child directories to include (default: 0, exact match only)",
      minimum: 0,
      maximum: 5,
    }),
  ),
});

type ListSessionsParamsType = {
  cwd: string;
  limit?: number;
  depth?: number;
};

interface ListSessionsDetails {
  cwd: string;
  limit: number;
  depth: number;
  resultCount: number;
  results: SessionListResult[];
}

type ExecuteResult = AgentToolResult<ListSessionsDetails>;

export const LIST_SESSIONS_GUIDANCE = `
## list_sessions

Use list_sessions to see recent sessions for a specific directory.

**When to use:**
- User wants to see what sessions exist for a project directory
- User wants to browse recent sessions without a keyword search
- User wants to see sessions from child directories of a project

**When NOT to use:**
- User wants to search by keyword (use find_sessions)
- User wants to read a specific session (use read_session)
`;

/**
 * Setup the list_sessions tool for browsing sessions by directory.
 */
export default async function (pi: ExtensionAPI) {
  pi.registerTool<typeof ListSessionsParams, ListSessionsDetails>({
    name: "list_sessions",
    label: "List Sessions",
    description: `List past Pi coding sessions for a given directory.

WHEN TO USE:
- Browse recent sessions for a project directory
- See what sessions exist without a keyword search
- List sessions from child directories with depth parameter

RESULTS: Returns sessions sorted by modification date (newest first) with metadata including name, message count, and first user message.`,
    promptSnippet:
      "List recent Pi sessions for a directory, optionally including child directories.",
    promptGuidelines: [
      "list_sessions: Use to list sessions for a specific directory without keyword search.",
      "list_sessions: Use depth > 0 to include sessions from child directories.",
      "list_sessions: Do not use for keyword search (use find_sessions instead).",
    ],

    parameters: ListSessionsParams,

    async execute(
      _toolCallId: string,
      params: ListSessionsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ): Promise<ExecuteResult> {
      const { cwd, limit = 20, depth = 0 } = params;

      let results: SessionListResult[] = [];
      try {
        results = listSessions(cwd, limit, depth);
      } catch (err) {
        console.error("[list-sessions] Error:", err);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                cwd,
                resultCount: 0,
                results: [],
                error: `List failed: ${err instanceof Error ? err.message : String(err)}`,
              }),
            },
          ],
          details: {
            cwd,
            limit,
            depth,
            resultCount: 0,
            results: [],
          },
        };
      }

      const resultJson = JSON.stringify({
        cwd,
        resultCount: results.length,
        results: results.map((r) => ({
          id: r.id,
          path: r.path,
          cwd: r.cwd,
          name: r.name,
          created: r.created,
          modified: r.modified,
          messageCount: r.messageCount,
          firstMessage: r.firstMessage,
        })),
      });

      return {
        content: [{ type: "text", text: resultJson }],
        details: {
          cwd,
          limit,
          depth,
          resultCount: results.length,
          results,
        },
      };
    },

    renderCall(args: ListSessionsParamsType, theme: Theme) {
      return new ToolCallHeader(
        {
          toolName: "List Sessions",
          mainArg: args.cwd,
          optionArgs: [
            {
              label: "limit",
              value: String(args.limit ?? 20),
              tone: "accent",
            },
            ...(args.depth
              ? [
                  {
                    label: "depth",
                    value: String(args.depth),
                    tone: "accent" as const,
                  },
                ]
              : []),
          ],
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<ListSessionsDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { details } = result;

      if (!details) {
        const text = result.content[0];
        const content = text?.type === "text" ? text.text : "No result";
        return new Text(content, 0, 0);
      }

      const { cwd, resultCount, results, limit, depth } = details;
      const fields: Array<
        { label: string; value: string; showCollapsed?: boolean } | Text
      > = [];

      if (resultCount === 0) {
        fields.push(
          new Text(
            `${theme.fg("muted", "No sessions found for")} ${theme.fg("accent", cwd)}`,
            0,
            0,
          ),
        );
      } else {
        const lines: string[] = [];

        if (!options.expanded) {
          for (const session of results) {
            const date = (session.created || session.modified || "").slice(
              0,
              10,
            );
            const label = session.name || session.firstMessage || "(untitled)";
            const preview =
              label.length > 48 ? `${label.slice(0, 48)}...` : label;
            const msgCount = `${session.messageCount} msg${session.messageCount === 1 ? "" : "s"}`;

            lines.push(
              `  ${theme.fg("success", "•")} ${theme.fg("accent", session.id.slice(0, 8))} ${theme.fg("muted", "- ")}${theme.fg("muted", date)} ${theme.fg("muted", "- ")}${theme.fg("toolOutput", preview)} ${theme.fg("muted", "- ")}${theme.fg("success", msgCount)}`,
            );
          }
        } else {
          for (const session of results) {
            const date = (session.created || session.modified || "").slice(
              0,
              10,
            );
            const title = session.name || "(untitled)";
            const firstMessage = session.firstMessage || "(no messages yet)";
            const msgCount = `${session.messageCount} msg${session.messageCount === 1 ? "" : "s"}`;

            if (lines.length > 0) lines.push("");
            lines.push(
              `${theme.fg("muted", "┌─")} ${theme.fg("accent", session.id.slice(0, 8))} ${theme.fg("muted", "•")} ${theme.fg("muted", date)} ${theme.fg("muted", "•")} ${theme.fg("toolOutput", title)} ${theme.fg("muted", "•")} ${theme.fg("success", msgCount)}`,
            );
            if (session.cwd !== cwd) {
              lines.push(
                `${theme.fg("muted", "│")} ${theme.fg("muted", "dir:")} ${theme.fg("accent", session.cwd)}`,
              );
            }
            lines.push(
              `${theme.fg("muted", "│")} ${theme.fg("muted", "first:")} ${theme.fg("toolOutput", firstMessage)}`,
            );
            lines.push(theme.fg("muted", "└─"));
          }
        }

        if (lines.length > 0) {
          fields.push(new Text(lines.join("\n"), 0, 0));
        }
      }

      const footerItems: Array<{
        label: string;
        value: string;
        tone?: "muted" | "accent" | "success" | "warning" | "error";
      }> = [
        { label: "sessions", value: String(resultCount), tone: "success" },
        { label: "limit", value: String(limit), tone: "muted" },
      ];
      if (depth > 0) {
        footerItems.push({
          label: "depth",
          value: String(depth),
          tone: "accent" as const,
        });
      }

      const footer = new ToolFooter(theme, { items: footerItems });

      return new ToolBody(
        {
          fields,
          footer,
        },
        options,
        theme,
      );
    },
  });
}
