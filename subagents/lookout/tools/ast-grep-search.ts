/**
 * AST search tool wrapping ast-grep CLI.
 */

import { spawn } from "node:child_process";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const DEFAULT_MAX_RESULTS = 10;
const MAX_SNIPPET_LENGTH = 160;

const parameters = Type.Object({
  pattern: Type.String({
    description:
      "ast-grep pattern to match. Use metavariables like $VAR or $$$ARGS.",
  }),
  lang: Type.Optional(
    Type.String({
      description:
        "Optional language for parsing the pattern, e.g. 'typescript' or 'tsx'.",
    }),
  ),
  paths: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Optional paths to search within. Relative paths are resolved from the current working directory.",
    }),
  ),
  maxResults: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return (default: 10)",
      default: DEFAULT_MAX_RESULTS,
    }),
  ),
});

type AstGrepParams = {
  pattern: string;
  lang?: string;
  paths?: string[];
  maxResults?: number;
};

type AstGrepJsonMatch = {
  file?: string;
  lines?: string;
  range?: {
    start?: { line?: number };
    end?: { line?: number };
  };
};

function truncateSnippet(snippet: string): string {
  const normalized = snippet.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_SNIPPET_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_SNIPPET_LENGTH - 3)}...`;
}

function formatMatch(match: AstGrepJsonMatch): string | null {
  if (!match.file) {
    return null;
  }

  const startLine = (match.range?.start?.line ?? 0) + 1;
  const endLine = (match.range?.end?.line ?? startLine - 1) + 1;
  const lineRange =
    endLine > startLine ? `L${startLine}-L${endLine}` : `L${startLine}`;
  const snippet = truncateSnippet(match.lines ?? "");

  return snippet
    ? `${match.file}:${lineRange} ${snippet}`
    : `${match.file}:${lineRange}`;
}

async function runAstGrep(
  cwd: string,
  pattern: string,
  lang: string | undefined,
  paths: string[] | undefined,
  maxResults: number,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["run", "-p", pattern];

    if (lang) {
      args.push("--lang", lang);
    }

    args.push("--json=stream");

    if (paths && paths.length > 0) {
      args.push(...paths);
    }

    const child = spawn("ast-grep", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          child.kill("SIGTERM");
          reject(new Error("Search aborted"));
        },
        { once: true },
      );
    }

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `ast-grep exited with code ${code ?? "unknown"}`,
          ),
        );
        return;
      }

      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const formatted: string[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as AstGrepJsonMatch;
          const formattedMatch = formatMatch(parsed);
          if (formattedMatch) {
            formatted.push(formattedMatch);
          }
        } catch {
          reject(new Error(`Failed to parse ast-grep JSON output: ${line}`));
          return;
        }
      }

      if (formatted.length === 0) {
        resolve("No results found.");
        return;
      }

      const limited = formatted.slice(0, maxResults);
      const omittedCount = formatted.length - limited.length;
      const summary =
        omittedCount > 0 ? `\n... ${omittedCount} more matches omitted.` : "";
      resolve(`${limited.join("\n")}${summary}`);
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "ast-grep is not installed or not in PATH. Install ast-grep before using ast_grep.",
          ),
        );
        return;
      }
      reject(err);
    });
  });
}

export function createAstGrepSearchTool(
  cwd: string,
): ToolDefinition<typeof parameters, undefined> {
  return {
    name: "ast_grep",
    label: "AST Grep",
    description: `Structural AST search powered by ast-grep.

Use code-shaped patterns with metavariables.
- $VAR matches one AST node
- $$$ARGS matches zero or more AST nodes

Returns compact file paths, line ranges, and snippets.`,
    parameters,

    async execute(_toolCallId, args, signal, _onUpdate, _ctx) {
      const {
        pattern,
        lang,
        paths,
        maxResults = DEFAULT_MAX_RESULTS,
      } = args as AstGrepParams;

      try {
        const output = await runAstGrep(
          cwd,
          pattern,
          lang,
          paths,
          maxResults,
          signal,
        );

        return {
          content: [{ type: "text" as const, text: output }],
          details: undefined,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          details: undefined,
        };
      }
    },
  };
}
