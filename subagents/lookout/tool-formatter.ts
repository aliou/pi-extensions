/**
 * Tool call formatter for Lookout subagent.
 */

import { shortenPath } from "@subagents/lib/paths";
import type { SubagentToolCall } from "@subagents/lib/types";

/** Create a lookout tool formatter with shortened path display */
export function createLookoutToolFormatter(
  cwd?: string,
): (tc: SubagentToolCall) => { label: string; detail: string } {
  const sp = (p: string) => shortenPath(p, cwd);

  return (tc: SubagentToolCall) => {
    const { toolName, args } = tc;

    switch (toolName) {
      case "ast_grep": {
        const pattern = args.pattern as string | undefined;
        const lang = args.lang as string | undefined;
        const paths = Array.isArray(args.paths)
          ? (args.paths as string[])
          : undefined;
        const truncated = pattern
          ? `"${pattern.slice(0, 50)}${pattern.length > 50 ? "..." : ""}"`
          : "...";
        const scope = paths?.length
          ? ` in ${paths
              .slice(0, 2)
              .map((p) => sp(p))
              .join(", ")}${paths.length > 2 ? ", ..." : ""}`
          : "";
        return {
          label: "AST Grep",
          detail: `${truncated}${lang ? ` (${lang})` : ""}${scope}`,
        };
      }
      case "grep": {
        const pattern = args.pattern as string | undefined;
        const path = args.path as string | undefined;
        return {
          label: "Grep",
          detail: pattern
            ? `"${pattern}"${path ? ` in ${sp(path)}` : ""}`
            : "...",
        };
      }
      case "find": {
        const name = args.name as string | undefined;
        const path = args.path as string | undefined;
        return {
          label: "Find",
          detail: name ? `"${name}"${path ? ` in ${sp(path)}` : ""}` : "...",
        };
      }
      case "read": {
        const path = args.path as string | undefined;
        return {
          label: "Read",
          detail: path ? sp(path) : "...",
        };
      }
      case "ls": {
        const path = args.path as string | undefined;
        return {
          label: "List",
          detail: path ? sp(path) : ".",
        };
      }
      default:
        return {
          label: toolName,
          detail: JSON.stringify(args).slice(0, 50),
        };
    }
  };
}
