import { existsSync, lstatSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool, truncateLine } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { BLOCKED_PATHS } from "./blocked-paths";
import { resolveSearchPaths } from "./path-utils";
import { renderCall } from "./render";
import type { GrepMatchData, HarnessGrepDetails, RgMatch } from "./types";

const DEFAULT_LIMIT = 100;

const WrappedSchema = Type.Object({
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

function createGrepTool(pi: ExtensionAPI) {
  return defineTool({
    name: "grep",
    label: "grep",
    description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} matches or 50KB (whichever is hit first). Long lines are truncated to 500 chars.`,
    parameters: WrappedSchema,
    promptGuidelines: [
      "grep: Search file contents for patterns (respects .gitignore).",
      "grep: Use literal=true when searching for strings with special regex characters (e.g. symbols, paths).",
      "grep: Use glob to narrow search to specific file types (e.g. '*.ts', '**/*.spec.ts').",
      "grep: Use context to show surrounding lines for understanding match context.",
    ],
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
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

      const rawSearchPath = searchDir || ".";
      const absoluteSearchPaths = resolveSearchPaths(ctx.cwd, rawSearchPath);
      const absoluteSearchPath = absoluteSearchPaths[0] ?? ctx.cwd;

      for (const path of absoluteSearchPaths) {
        if (BLOCKED_PATHS.has(path)) {
          throw new Error(
            `Searching '${path}' is not allowed — too broad. Narrow the search to a specific project or subdirectory.`,
          );
        }

        if (!existsSync(path)) {
          throw new Error(`Path not found: ${path}`);
        }
      }

      const isDirectoryByPath = new Map<string, boolean>();
      for (const path of absoluteSearchPaths) {
        try {
          isDirectoryByPath.set(path, lstatSync(path).isDirectory());
        } catch (_error) {
          void _error;
          throw new Error(`Cannot stat path: ${path}`);
        }
      }

      const isSingleDirectory =
        absoluteSearchPaths.length === 1 &&
        (isDirectoryByPath.get(absoluteSearchPaths[0] ?? "") ?? false);

      const contextValue = context && context > 0 ? context : 0;
      const effectiveLimit = Math.max(1, limit ?? DEFAULT_LIMIT);

      const rgArgs = ["--json", "--line-number", "--color=never", "--hidden"];
      if (ignoreCase) rgArgs.push("--ignore-case");
      if (literal) rgArgs.push("--fixed-strings");
      if (glob) rgArgs.push("--glob", glob);
      rgArgs.push(pattern, ...absoluteSearchPaths);

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
        } catch (_error) {
          void _error;
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
        if (absoluteSearchPaths.length > 1) {
          const rel = relative(ctx.cwd, filePath);
          if (rel && !rel.startsWith("..")) return rel.replace(/\\/g, "/");
          return filePath.replace(/\\/g, "/");
        }

        const singleSearchPath = absoluteSearchPaths[0] ?? absoluteSearchPath;
        if (isSingleDirectory) {
          const rel = filePath
            .slice(singleSearchPath.length)
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
          } catch (_error) {
            void _error;
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
          isSingleDirectory &&
          searchDir &&
          searchDir !== "." &&
          searchDir !== "./"
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

    renderCall(args, theme) {
      return renderCall(args, theme);
    },
  });
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createGrepTool(pi));
}
