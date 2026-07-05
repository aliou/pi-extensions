import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  type GitHubClient,
  normalizeRepository,
  parseJson,
  textResult,
} from "../../lib/github-client";

const Params = Type.Object({
  pattern: Type.String({
    description:
      "GitHub code search query to run inside the selected repository. Put search terms, operators, and qualifiers here.",
  }),
  path: Type.Optional(
    Type.String({
      description: "Optional path within the repository to limit the search",
    }),
  ),
  repository: Type.String({
    description:
      'Single GitHub repository to search. Use "owner/repo" or "https://github.com/owner/repo". Do not pass GitHub search pages such as "https://github.com/search".',
  }),
  limit: Type.Optional(
    Type.Number({
      description:
        "Maximum number of search results to return (default: 30, max: 100)",
      minimum: 1,
      maximum: 100,
    }),
  ),
  offset: Type.Optional(
    Type.Number({
      description:
        "Number of results to skip for pagination (default: 0). Must be divisible by limit.",
      minimum: 0,
    }),
  ),
});

interface SearchResponse {
  total_count?: number;
  items?: Array<{
    path: string;
    text_matches?: Array<{ property?: string; fragment?: string }>;
  }>;
}

export function createSearchGitHubTool(
  client: GitHubClient,
  cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "search_github",
    label: "Search GitHub",
    description:
      "Search for code patterns inside a single GitHub repository and return matches grouped by file, with surrounding context.",
    promptSnippet:
      "Search code patterns inside a GitHub repo (no clone needed)",
    promptGuidelines: [
      "Use search_github to find code in a remote repo without cloning; use list_repositories to discover repos first.",
    ],
    parameters: Params,
    async execute(_id, params, signal) {
      const limit = params.limit ?? 30;
      const offset = params.offset ?? 0;
      if (offset % limit !== 0)
        throw new Error(
          `offset (${offset}) must be divisible by limit (${limit})`,
        );
      const repository = normalizeRepository(params.repository);
      const query = `${params.pattern} repo:${repository}${params.path ? ` path:${params.path}` : ""}`;
      const json = await client.api("search/code", cwd, {
        method: "GET",
        fields: {
          q: query,
          per_page: String(Math.min(limit, 100)),
          page: String(Math.floor(offset / limit) + 1),
        },
        headers: ["Accept: application/vnd.github.v3.text-match+json"],
        signal,
      });
      const response = parseJson<SearchResponse>(json);
      const byFile = new Map<string, string[]>();
      for (const item of response.items ?? []) {
        const chunks = byFile.get(item.path) ?? [];
        for (const match of item.text_matches ?? []) {
          if (match.property === "content" && match.fragment)
            chunks.push(match.fragment.trim());
        }
        byFile.set(item.path, chunks);
      }
      const details = {
        results: Array.from(byFile, ([file, chunks]) => ({ file, chunks })),
        totalCount: response.total_count ?? 0,
      };
      const text = details.results
        .map(
          (result) =>
            `${result.file}\n${result.chunks.map((chunk) => `  ${chunk}`).join("\n")}`,
        )
        .join("\n\n");
      return textResult(text || "No results", details);
    },
  };
}
