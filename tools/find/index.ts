import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { relative, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { BLOCKED_PATHS } from "./blocked-paths";
import { renderCall } from "./render";
import type { HarnessFindDetails } from "./types";

const DEFAULT_LIMIT = 1000;

const WrappedSchema = Type.Object({
  pattern: Type.String({
    description: "The pattern to search for (glob or regex)",
  }),
  path: Type.Optional(
    Type.String({
      description: "The directory to search in (defaults to cwd)",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description: `Maximum number of results (defaults to ${DEFAULT_LIMIT})`,
    }),
  ),
});

function createFindTool(pi: ExtensionAPI) {
  return defineTool({
    name: "find",
    label: "Find Files",
    description: `Find files by name using the \`fd\` command-line tool. Supports glob patterns and regex. Searches recursively from the specified path. Respects .gitignore. Results are truncated to ${DEFAULT_LIMIT} entries.`,
    parameters: WrappedSchema,
    promptGuidelines: [
      "find: Use find instead of shell find or fd when locating files in the project.",
      "find: Prefer passing path explicitly instead of scanning broad roots.",
    ],
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const pattern = params.pattern;
      const searchPath = params.path;
      const limit = params.limit ?? DEFAULT_LIMIT;

      if (signal?.aborted) {
        throw new Error("Search was aborted");
      }

      let resolvedPath = searchPath || ".";
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

      const fdArgs = [
        "--glob",
        "--color=never",
        "--hidden",
        "--max-results",
        String(limit),
        pattern,
        absoluteSearchPath,
      ];

      const result = await pi.exec("fd", fdArgs, {
        signal: signal ?? undefined,
        cwd: ctx.cwd,
      });

      if (result.killed && signal?.aborted) {
        throw new Error("Search was aborted");
      }

      if (result.code !== 0 && !result.stdout) {
        throw new Error(result.stderr || "Unknown error");
      }

      const allResults = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      if (allResults.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No files found matching the pattern.",
            },
          ],
          details: {},
        };
      }

      const results = allResults.map((absolutePath) => {
        if (absolutePath.startsWith(absoluteSearchPath)) {
          return absolutePath.slice(absoluteSearchPath.length + 1);
        }
        return absolutePath;
      });

      const wasTruncated = results.length >= limit;

      const details: HarnessFindDetails = {
        resultLimitReached: wasTruncated ? results.length : undefined,
        totalResults: results.length,
        paths: results,
        relativeTo:
          searchPath && searchPath !== "." && searchPath !== "./"
            ? relative(ctx.cwd, absoluteSearchPath) || "."
            : undefined,
      };

      const outputText = results.join("\n");

      return {
        content: [{ type: "text", text: outputText }],
        details,
      };
    },

    renderCall(args, theme) {
      return renderCall(args, theme);
    },
  });
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createFindTool(pi));
}
