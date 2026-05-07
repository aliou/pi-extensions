import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  type GitHubClient,
  normalizeRepository,
  parseJson,
  textResult,
} from "../lib/github-client";

const Params = Type.Object({
  filePattern: Type.String({
    description:
      'Glob pattern to match within the selected repository (e.g., "**/*.ts", "src/**/*.test.js")',
  }),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return (default = 100).",
    }),
  ),
  offset: Type.Optional(
    Type.Number({ description: "Number of results to skip for pagination" }),
  ),
  repository: Type.String({
    description:
      'Single GitHub repository to search. Use "owner/repo" or "https://github.com/owner/repo". Do not pass GitHub search pages such as "https://github.com/search".',
  }),
});

interface TreeResponse {
  tree?: Array<{ path: string; type: "blob" | "tree" | string }>;
  truncated?: boolean;
}

export function createGlobGitHubTool(
  client: GitHubClient,
  cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "glob_github",
    label: "Glob GitHub",
    description: "Find files matching a glob pattern in a GitHub repository.",
    parameters: Params,
    async execute(_id, params, signal) {
      const repository = normalizeRepository(params.repository);
      const json = await client.api(`repos/${repository}/git/trees/HEAD`, cwd, {
        method: "GET",
        fields: { recursive: "1" },
        signal,
      });
      const response = parseJson<TreeResponse>(json);
      if (response.truncated) {
        throw new Error(
          "Repository tree is too large for recursive listing. Try a more specific search or use search_github instead.",
        );
      }
      const offset = params.offset ?? 0;
      const limit = params.limit ?? 100;
      const matches = (response.tree ?? [])
        .filter(
          (entry) =>
            entry.type === "blob" && matchGlob(params.filePattern, entry.path),
        )
        .slice(offset, offset + limit)
        .map((entry) => entry.path);
      return textResult(matches.join("\n") || "No matches", { matches });
    },
  };
}

function matchGlob(glob: string, path: string): boolean {
  let source = "";
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index] ?? "";
    if (char === "*") {
      if (glob[index + 1] === "*") {
        if (glob[index + 2] === "/") {
          source += "(?:.+/)?";
          index += 2;
        } else {
          source += ".*";
          index++;
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (char === "{") {
      const end = glob.indexOf("}", index);
      if (end === -1) {
        source += escapeRegExp(char);
      } else {
        const alternatives = glob
          .slice(index + 1, end)
          .split(",")
          .map(escapeRegExp)
          .join("|");
        source += `(?:${alternatives})`;
        index = end;
      }
    } else if (char === "[") {
      const end = glob.indexOf("]", index);
      if (end === -1) {
        source += escapeRegExp(char);
      } else {
        source += glob.slice(index, end + 1);
        index = end;
      }
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`).test(path);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
