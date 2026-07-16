import { existsSync, lstatSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  defineTool,
  truncateHead,
  truncateLine,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { BLOCKED_PATHS } from "./blocked-paths";
import { resolveSearchPaths } from "./path-utils";
import { renderCall } from "./render";
import { runRg } from "./rg";
import type { GrepMatchData, HarnessGrepDetails } from "./types";

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
  noIgnore: Type.Optional(
    Type.Boolean({
      description:
        "Include files ignored by .gitignore / .ignore / .fdignore (default: false)",
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

function createGrepTool() {
  return defineTool({
    name: "grep",
    label: "grep",
    description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore unless noIgnore is set. Output is truncated to ${DEFAULT_LIMIT} matches or 50KB (whichever is hit first). Long lines are truncated to 500 chars.`,
    promptSnippet: "Search file contents for patterns (respects .gitignore)",
    parameters: WrappedSchema,
    promptGuidelines: [
      "grep: Search file contents for patterns (respects .gitignore).",
      "grep: Use literal=true when searching for strings with special regex characters (e.g. symbols, paths).",
      "grep: Use glob to narrow search to specific file types (e.g. '*.ts', '**/*.spec.ts').",
      "grep: Use context to show surrounding lines for understanding match context.",
      "grep: Use noIgnore=true when the target files are ignored by .gitignore.",
    ],
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const {
        pattern,
        path: searchDir,
        glob,
        ignoreCase,
        literal,
        noIgnore,
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
      if (noIgnore) rgArgs.push("--no-ignore");
      if (glob) rgArgs.push("--glob", glob);
      rgArgs.push("--", pattern, ...absoluteSearchPaths);
      const result = await runRg(
        rgArgs,
        ctx.cwd,
        signal ?? undefined,
        effectiveLimit,
      );

      if (result.code !== 0 && result.code !== 1 && !result.killed) {
        throw new Error(
          result.stderr || `ripgrep exited with code ${result.code}`,
        );
      }

      const { matches, matchCount, matchLimitReached } = result;

      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: result.outputTruncated
                ? "Search output exceeded the safety limit before any matches could be collected"
                : "No matches found",
            },
          ],
          details: result.outputTruncated
            ? { searchOutputTruncated: true }
            : undefined,
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
      let renderedBytes = 0;
      let renderingTruncated = false;

      const addMatchData = (data: GrepMatchData): boolean => {
        const rendered = `${data.path}:${data.line}: ${data.text}`;
        const lineBytes = Buffer.byteLength(rendered, "utf8");
        const separatorBytes = matchData.length > 0 ? 1 : 0;
        if (
          matchData.length >= DEFAULT_MAX_LINES ||
          renderedBytes + separatorBytes + lineBytes > DEFAULT_MAX_BYTES
        ) {
          renderingTruncated = true;
          return false;
        }
        matchData.push(data);
        renderedBytes += separatorBytes + lineBytes;
        return true;
      };

      for (const match of matches) {
        if (renderingTruncated) break;
        const relativePath = formatPath(match.filePath);
        const lines = getFileLines(match.filePath);

        if (!lines.length) {
          addMatchData({
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
            if (
              !addMatchData({
                path: relativePath,
                line: current,
                text: `  ${truncatedText.trim()}`,
              })
            ) {
              break;
            }
          } else {
            if (
              !addMatchData({
                path: relativePath,
                line: current,
                text: truncatedText.trim(),
              })
            ) {
              break;
            }
          }
        }
      }

      const textContent = matchData
        .map((m) => `${m.path}:${m.line}: ${m.text}`)
        .join("\n");
      const truncation = truncateHead(textContent, {
        maxBytes: DEFAULT_MAX_BYTES,
        maxLines: DEFAULT_MAX_LINES,
      });

      const details: HarnessGrepDetails = {
        matchCount,
        matches: matchData.slice(0, truncation.outputLines),
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
      if (result.outputTruncated) details.searchOutputTruncated = true;
      if (renderingTruncated) details.outputTruncated = true;
      if (truncation.truncated) details.truncation = truncation;

      return {
        content: [{ type: "text", text: truncation.content }],
        details,
      };
    },

    renderCall(args, theme) {
      return renderCall(args, theme);
    },
  });
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createGrepTool());
}
