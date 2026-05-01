import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import {
  type GitHubClient,
  normalizeRepository,
  parseJson,
  textResult,
} from "../lib/github-client";

const Params = Type.Object({
  query: Type.Optional(
    Type.String({
      description:
        "Optional text search over commit messages and author information. If omitted, returns commits matching the other filters.",
    }),
  ),
  author: Type.Optional(
    Type.String({ description: "Filter commits by author username or email" }),
  ),
  since: Type.Optional(
    Type.String({
      description:
        'ISO 8601 date string for earliest commit date (e.g., "2024-01-01T00:00:00Z")',
    }),
  ),
  until: Type.Optional(
    Type.String({
      description:
        'ISO 8601 date string for latest commit date (e.g., "2024-02-01T00:00:00Z")',
    }),
  ),
  path: Type.Optional(
    Type.String({
      description: "Filter commits that changed specific files or directories",
    }),
  ),
  repository: Type.String({
    description:
      'Single GitHub repository to search. Use "owner/repo" or "https://github.com/owner/repo". Do not pass GitHub search pages such as "https://github.com/search".',
  }),
  limit: Type.Optional(
    Type.Number({
      description:
        "Maximum number of commits to return (default: 50, max: 100)",
      minimum: 1,
      maximum: 100,
    }),
  ),
  offset: Type.Optional(
    Type.Number({
      description:
        "Number of commits to skip for pagination (default: 0). Must be divisible by limit.",
      minimum: 0,
    }),
  ),
});

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
}

interface CommitSearchResponse {
  total_count?: number;
  items?: Commit[];
}

export function createCommitSearchTool(
  client: GitHubClient,
  cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "commit_search",
    label: "Commit Search",
    description: "Search commit history in a single GitHub repository.",
    parameters: Params,
    async execute(_id, params, signal) {
      const limit = params.limit ?? 50;
      const offset = params.offset ?? 0;
      if (offset % limit !== 0)
        throw new Error(
          `offset (${offset}) must be divisible by limit (${limit})`,
        );
      const perPage = Math.min(limit, 100);
      const page = String(Math.floor(offset / perPage) + 1);
      const repository = normalizeRepository(params.repository);
      let commits: Commit[];
      let totalCount = 0;

      if (params.path || !params.query) {
        const fields: Record<string, string> = {
          per_page: String(perPage),
          page,
        };
        if (params.author) fields.author = params.author;
        if (params.since) fields.since = params.since;
        if (params.until) fields.until = params.until;
        if (params.path) fields.path = params.path;
        commits = parseJson<Commit[]>(
          await client.api(`repos/${repository}/commits`, cwd, {
            method: "GET",
            fields,
            signal,
          }),
        );
        if (params.query) {
          const q = params.query.toLowerCase();
          commits = commits.filter(
            (commit) =>
              commit.commit.message.toLowerCase().includes(q) ||
              commit.commit.author.name.toLowerCase().includes(q) ||
              commit.commit.author.email.toLowerCase().includes(q),
          );
        }
        totalCount = commits.length;
      } else {
        const query = [params.query, `repo:${repository}`];
        if (params.author) query.push(`author:${params.author}`);
        if (params.since) query.push(`author-date:>=${params.since}`);
        if (params.until) query.push(`author-date:<=${params.until}`);
        const response = parseJson<CommitSearchResponse>(
          await client.api("search/commits", cwd, {
            method: "GET",
            fields: { q: query.join(" "), per_page: String(perPage), page },
            headers: ["Accept: application/vnd.github+json"],
            signal,
          }),
        );
        commits = response.items ?? [];
        totalCount = response.total_count ?? commits.length;
      }

      const details = {
        commits: commits.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author,
        })),
        totalCount,
      };
      const text = details.commits
        .map((commit) =>
          [
            `${commit.sha.slice(0, 12)} ${commit.author.date}`,
            commit.message.split("\n")[0],
            `${commit.author.name} <${commit.author.email}>`,
          ].join("\n"),
        )
        .join("\n\n");
      return textResult(text || "No commits", details);
    },
  };
}
