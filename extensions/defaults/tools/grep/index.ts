import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { relative, resolve } from "node:path";
import { ToolBody, ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  GrepToolDetails,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  keyHint,
  truncateLine,
} from "@mariozechner/pi-coding-agent";
import { type Component, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "typebox";
import { Tree, type TreeNode, type TreeTone } from "../../lib/tree";

const DEFAULT_LIMIT = 100;
const GREP_MAX_LINE_LENGTH = 500;
const COLLAPSED_MATCH_LIMIT = 30;

const BLOCKED_PATHS = new Set([
  homedir(),
  "/",
  "/Users",
  "/home",
  "/tmp",
  "/var",
  "/etc",
  "/opt",
  "/usr",
  "/System",
  "/Library",
  "/Applications",
  "/Volumes",
  "/nix",
  "/snap",
  "/proc",
  "/sys",
  "/dev",
  "/run",
  "/boot",
  "/sbin",
  "/bin",
]);

interface RgMatch {
  filePath: string;
  lineNumber: number;
}

interface GrepMatchData {
  path: string;
  line: number;
  text: string;
}

interface HarnessGrepDetails extends GrepToolDetails {
  relativeTo?: string;
  matchCount?: number;
  matches?: GrepMatchData[];
}

export default function (pi: ExtensionAPI): void {
  const wrappedSchema = Type.Object({
    pattern: Type.String({
      description: "Search pattern (regex or literal string)",
    }),
    path: Type.Optional(
      Type.String({
        description: "Directory or file to search (default: current directory)",
      }),
    ),
    glob: Type.Optional(
      Type.String({
        description:
          "Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'",
      }),
    ),
    ignoreCase: Type.Optional(
      Type.Boolean({
        description: "Case-insensitive search (default: false)",
      }),
    ),
    literal: Type.Optional(
      Type.Boolean({
        description:
          "Treat pattern as literal string instead of regex (default: false)",
      }),
    ),
    context: Type.Optional(
      Type.Number({
        description:
          "Number of lines to show before and after each match (default: 0)",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: `Maximum number of matches to return (default: ${DEFAULT_LIMIT})`,
      }),
    ),
  });

  pi.registerTool<typeof wrappedSchema, HarnessGrepDetails | undefined>({
    name: "grep",
    label: "grep",
    description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} matches or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Long lines are truncated to ${GREP_MAX_LINE_LENGTH} chars.`,
    parameters: wrappedSchema,
    promptGuidelines: [
      "Search file contents for patterns (respects .gitignore)",
    ],
    async execute(
      _toolCallId: string,
      params: {
        pattern: string;
        path?: string;
        glob?: string;
        ignoreCase?: boolean;
        literal?: boolean;
        context?: number;
        limit?: number;
      },
      signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: {
        cwd: string;
      },
    ): Promise<{
      content: Array<{ type: "text"; text: string }>;
      details: HarnessGrepDetails | undefined;
    }> {
      const {
        pattern,
        path: searchDir,
        glob,
        ignoreCase,
        literal,
        context,
        limit,
      } = params;

      if (signal?.aborted) {
        throw new Error("Operation aborted");
      }

      let resolvedPath = searchDir || ".";
      if (resolvedPath === "~" || resolvedPath.startsWith("~/")) {
        resolvedPath = resolvedPath.replace(/^~/, homedir());
      }
      const absoluteSearchPath = resolve(ctx.cwd, resolvedPath);

      if (BLOCKED_PATHS.has(absoluteSearchPath)) {
        throw new Error(
          `Searching '${absoluteSearchPath}' is not allowed — too broad. Narrow the search to a specific project or subdirectory.`,
        );
      }

      if (!existsSync(absoluteSearchPath)) {
        throw new Error(`Path not found: ${absoluteSearchPath}`);
      }

      let isDirectory = false;
      try {
        isDirectory = lstatSync(absoluteSearchPath).isDirectory();
      } catch {
        throw new Error(`Cannot stat path: ${absoluteSearchPath}`);
      }

      const contextValue = context && context > 0 ? context : 0;
      const effectiveLimit = Math.max(1, limit ?? DEFAULT_LIMIT);

      const rgArgs = ["--json", "--line-number", "--color=never", "--hidden"];
      if (ignoreCase) rgArgs.push("--ignore-case");
      if (literal) rgArgs.push("--fixed-strings");
      if (glob) rgArgs.push("--glob", glob);
      rgArgs.push(pattern, absoluteSearchPath);

      const result = await pi.exec("rg", rgArgs, {
        signal: signal ?? undefined,
        cwd: ctx.cwd,
      });

      if (result.killed && signal?.aborted) {
        throw new Error("Operation aborted");
      }

      if (result.code !== 0 && result.code !== 1) {
        throw new Error(
          result.stderr || `ripgrep exited with code ${result.code}`,
        );
      }

      // Parse rg JSON output to collect matches
      const matches: RgMatch[] = [];
      let matchCount = 0;
      let matchLimitReached = false;

      for (const line of result.stdout.split("\n")) {
        if (!line.trim()) continue;
        let event: {
          type: string;
          data?: { path?: { text: string }; line_number?: number };
        };
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type === "match") {
          matchCount++;
          const filePath = event.data?.path?.text;
          const lineNumber = event.data?.line_number;
          if (filePath && typeof lineNumber === "number") {
            if (matches.length < effectiveLimit) {
              matches.push({ filePath, lineNumber });
            }
          }
          if (matchCount >= effectiveLimit) {
            matchLimitReached = true;
          }
        }
      }

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: "No matches found" }],
          details: undefined,
        };
      }

      // Format path relative to search directory
      const formatPath = (filePath: string): string => {
        if (isDirectory) {
          const rel = filePath
            .slice(absoluteSearchPath.length)
            .replace(/^[/\\]/, "");
          if (rel) return rel.replace(/\\/g, "/");
        }
        return filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
      };

      // Read match text from files
      const fileCache = new Map<string, string[]>();
      const getFileLines = (filePath: string): string[] => {
        let lines = fileCache.get(filePath);
        if (!lines) {
          try {
            const content = readFileSync(filePath, "utf-8");
            lines = content
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n")
              .split("\n");
          } catch {
            lines = [];
          }
          fileCache.set(filePath, lines);
        }
        return lines;
      };

      let linesTruncated = false;
      const matchData: GrepMatchData[] = [];

      for (const match of matches) {
        const relativePath = formatPath(match.filePath);
        const lines = getFileLines(match.filePath);

        if (!lines.length) {
          matchData.push({
            path: relativePath,
            line: match.lineNumber,
            text: "(unable to read file)",
          });
          continue;
        }

        const start =
          contextValue > 0
            ? Math.max(1, match.lineNumber - contextValue)
            : match.lineNumber;
        const end =
          contextValue > 0
            ? Math.min(lines.length, match.lineNumber + contextValue)
            : match.lineNumber;

        for (let current = start; current <= end; current++) {
          const lineText = (lines[current - 1] ?? "").replace(/\r/g, "");
          const isMatchLine = current === match.lineNumber;
          const { text: truncatedText, wasTruncated } = truncateLine(lineText);
          if (wasTruncated) linesTruncated = true;

          if (contextValue > 0 && !isMatchLine) {
            matchData.push({
              path: relativePath,
              line: current,
              text: `  ${truncatedText.trim()}`,
            });
          } else {
            matchData.push({
              path: relativePath,
              line: current,
              text: truncatedText.trim(),
            });
          }
        }
      }

      const details: HarnessGrepDetails = {
        matchCount,
        matches: matchData,
        relativeTo:
          isDirectory && searchDir && searchDir !== "." && searchDir !== "./"
            ? relative(ctx.cwd, absoluteSearchPath) || "."
            : undefined,
      };
      if (matchLimitReached) details.matchLimitReached = effectiveLimit;
      if (linesTruncated) details.linesTruncated = true;

      // Text content for LLM consumption (flat format)
      const textContent = matchData
        .map((m) => `${m.path}:${m.line}: ${m.text}`)
        .join("\n");

      return {
        content: [{ type: "text", text: textContent }],
        details,
      };
    },

    renderCall(
      args: {
        pattern: string;
        path?: string;
        glob?: string;
        ignoreCase?: boolean;
        literal?: boolean;
        context?: number;
        limit?: number;
      },
      theme: Theme,
    ) {
      return new ToolCallHeader(
        {
          toolName: "Grep",
          mainArg: args.literal
            ? `\`${args.pattern}\``
            : `/${args.pattern || ""}/`,
          optionArgs: [
            ...(args.path ? [{ label: "in", value: args.path }] : []),
            ...(args.glob ? [{ label: "glob", value: args.glob }] : []),
            ...(args.limit
              ? [{ label: "limit", value: String(args.limit) }]
              : []),
            ...(args.ignoreCase
              ? [{ label: "icase", value: "true", tone: "accent" as const }]
              : []),
            ...(args.literal ? [{ label: "literal", value: "true" }] : []),
            ...(args.context
              ? [{ label: "ctx", value: String(args.context) }]
              : []),
          ],
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<HarnessGrepDetails | undefined>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const textContent = result.content[0];
      const output = (
        textContent?.type === "text" ? textContent.text : ""
      ).trim();

      if (!output || output === "No matches found") {
        return new Text(theme.fg("muted", output || "No result"), 0, 0);
      }

      const fields: Array<
        { label: string; value: string; showCollapsed?: boolean } | Text
      > = [];

      const spacer = new Spacer(1) as Component & { showCollapsed?: boolean };
      spacer.showCollapsed = true;
      fields.push(spacer as unknown as Text);

      // Build tree from structured match data
      const details = result.details;
      const allMatches = details?.matches ?? [];

      // Collapse by slicing matches, not rendered lines
      const maxMatches = options.expanded
        ? allMatches.length
        : COLLAPSED_MATCH_LIMIT;
      const displayMatches = allMatches.slice(0, maxMatches);
      const remainingMatches = allMatches.length - maxMatches;

      const tree = buildGrepTree(displayMatches);
      const treeComponent = new Tree(tree, { theme, dirSuffix: ":" });
      (treeComponent as Component & { showCollapsed?: boolean }).showCollapsed =
        true;
      fields.push(treeComponent as unknown as Text);

      const footerItems: Array<{
        label?: string;
        value: string;
        tone?: "muted" | "accent" | "success" | "warning" | "error";
      }> = [];

      if (remainingMatches > 0) {
        footerItems.push({
          value: `${remainingMatches} more matches, ${keyHint("app.tools.expand", "to expand")}`,
          tone: "muted",
        });
      }
      if (details?.matchCount) {
        footerItems.push({
          label: "matches",
          value: String(details.matchCount),
          tone: "success",
        });
      }
      if (details?.matchLimitReached) {
        footerItems.push({
          label: "limit",
          value: String(details.matchLimitReached),
          tone: "warning",
        });
      }
      if (details?.linesTruncated) {
        footerItems.push({
          value: "lines truncated",
          tone: "warning",
        });
      }

      const footer =
        footerItems.length > 0
          ? new ToolFooter(theme, { items: footerItems })
          : undefined;

      return new ToolBody({ fields, footer }, options, theme);
    },
  });
}

/** Group match data by file path and build a TreeNode tree. */
function buildGrepTree(matches: GrepMatchData[]): TreeNode[] {
  const byPath = new Map<string, GrepMatchData[]>();
  for (const m of matches) {
    let group = byPath.get(m.path);
    if (!group) {
      group = [];
      byPath.set(m.path, group);
    }
    group.push(m);
  }

  const roots: TreeNode[] = [];
  const entries = [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [path, fileMatches] of entries) {
    roots.push({
      label: path,
      tone: "accent",
      children: fileMatches.map((m) => ({
        label: `${m.line}: ${m.text}`,
        tone: "toolOutput" as TreeTone,
      })),
    });
  }

  return roots;
}
