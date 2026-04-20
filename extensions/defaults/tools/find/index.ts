import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { relative, resolve } from "node:path";
import { ToolBody, ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  FindToolDetails,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { keyHint } from "@mariozechner/pi-coding-agent";
import { type Component, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { Tree, type TreeNode, type TreeTone } from "../../lib/tree";

const DEFAULT_LIMIT = 1000;
const COLLAPSED_RESULT_LIMIT = 40;

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

interface HarnessFindDetails extends FindToolDetails {
  relativeTo?: string;
  totalResults?: number;
  paths?: string[];
}

export default function (pi: ExtensionAPI): void {
  const wrappedSchema = Type.Object({
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

  pi.registerTool<typeof wrappedSchema, HarnessFindDetails>({
    name: "find",
    label: "Find Files",
    description: `Find files by name using the \`fd\` command-line tool. Supports glob patterns and regex. Searches recursively from the specified path. Respects .gitignore. Results are truncated to ${DEFAULT_LIMIT} entries.`,
    parameters: wrappedSchema,
    promptGuidelines: [
      "Use find instead of shell find or fd when locating files in the project.",
      "Prefer passing path explicitly instead of scanning broad roots.",
    ],
    async execute(
      _toolCallId: string,
      params: {
        pattern: string;
        path?: string;
        limit?: number;
      },
      signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: {
        cwd: string;
      },
    ): Promise<{
      content: Array<{ type: "text"; text: string }>;
      details: HarnessFindDetails;
    }> {
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

    renderCall(
      args: {
        pattern: string;
        path?: string;
        limit?: number;
      },
      theme: Theme,
    ) {
      return new ToolCallHeader(
        {
          toolName: "Find",
          mainArg: args.pattern,
          optionArgs: [
            ...(args.path ? [{ label: "in", value: args.path }] : []),
            ...(args.limit
              ? [{ label: "limit", value: String(args.limit) }]
              : []),
          ],
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<HarnessFindDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const textContent = result.content[0];
      const output = (
        textContent?.type === "text" ? textContent.text : ""
      ).trim();

      if (!output || output === "No files found matching the pattern.") {
        return new Text(theme.fg("muted", output || "No result"), 0, 0);
      }

      const fields: Array<
        { label: string; value: string; showCollapsed?: boolean } | Text
      > = [];

      const spacer = new Spacer(1) as Component & { showCollapsed?: boolean };
      spacer.showCollapsed = true;
      fields.push(spacer as unknown as Text);

      // Build tree from structured path data
      const details = result.details;
      const allPaths = details?.paths ?? [];

      // Collapse by slicing paths, not rendered lines
      const maxPaths = options.expanded
        ? allPaths.length
        : COLLAPSED_RESULT_LIMIT;
      const displayPaths = allPaths.slice(0, maxPaths);
      const remainingPaths = allPaths.length - maxPaths;

      const tree = buildFindTree(displayPaths);
      const treeComponent = new Tree(tree, { theme, dirSuffix: "/" });
      (treeComponent as Component & { showCollapsed?: boolean }).showCollapsed =
        true;
      fields.push(treeComponent as unknown as Text);

      const footerItems: Array<{
        label?: string;
        value: string;
        tone?: "muted" | "accent" | "success" | "warning" | "error";
      }> = [];

      if (remainingPaths > 0) {
        footerItems.push({
          value: `${remainingPaths} more results, ${keyHint("app.tools.expand", "to expand")}`,
          tone: "muted",
        });
      }
      if (details?.totalResults) {
        footerItems.push({
          label: "results",
          value: String(details.totalResults),
          tone: "success",
        });
      }
      if (details?.resultLimitReached) {
        footerItems.push({
          label: "limit",
          value: String(details.resultLimitReached),
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

/**
 * Build a TreeNode tree from a flat list of relative file paths.
 * Creates a trie from the path segments, then converts to TreeNode format.
 * Directories are sorted before files, both alphabetically.
 */
function buildFindTree(paths: string[]): TreeNode[] {
  const root: TrieNode = { name: "", children: new Map(), isFile: false };

  for (const path of paths) {
    const clean = path.replace(/^\.\/?/, "");
    if (!clean) continue;
    const segments = clean.split("/");
    insertPath(root, segments);
  }

  return trieToTreeNodes(root);
}

interface TrieNode {
  name: string;
  children: Map<string, TrieNode>;
  isFile: boolean;
}

function insertPath(root: TrieNode, segments: string[]): void {
  let current = root;
  for (const [i, segment] of segments.entries()) {
    const isFile = i === segments.length - 1;
    const existing = current.children.get(segment);
    if (!existing) {
      const child: TrieNode = { name: segment, children: new Map(), isFile };
      current.children.set(segment, child);
      current = child;
    } else {
      if (isFile) existing.isFile = true;
      current = existing;
    }
  }
}

function trieToTreeNodes(node: TrieNode): TreeNode[] {
  const children = [...node.children.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return children.map((child) => ({
    label: child.name,
    tone: (child.isFile ? "toolOutput" : "accent") as TreeTone,
    children: child.children.size > 0 ? trieToTreeNodes(child) : undefined,
  }));
}
