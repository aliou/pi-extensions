import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { type GitHubClient, parseJson, textResult } from "../lib/github-client";

const Params = Type.Object({
  pattern: Type.Optional(
    Type.String({
      description: "Optional pattern to match in repository names",
    }),
  ),
  organization: Type.Optional(
    Type.String({
      description: "Optional organization name to filter repositories",
    }),
  ),
  language: Type.Optional(
    Type.String({
      description: "Optional programming language to filter repositories",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description:
        "Maximum number of repositories to return (default: 30, max: 100)",
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

interface Repo {
  full_name: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  private: boolean;
}

interface SearchResponse {
  total_count?: number;
  items?: Repo[];
}

export function createListRepositoriesTool(
  client: GitHubClient,
  cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "list_repositories",
    label: "List GitHub Repositories",
    description:
      "List repositories on GitHub, prioritizing repositories the user can already access.",
    parameters: Params,
    async execute(_id, params, signal) {
      const limit = params.limit ?? 30;
      const offset = params.offset ?? 0;
      if (offset % limit !== 0) {
        throw new Error(
          `offset (${offset}) must be divisible by limit (${limit})`,
        );
      }

      const repositories = await listRepositories(client, cwd, params, signal);
      const details = {
        repositories: repositories.slice(0, limit).map(formatRepo),
        totalCount: repositories.length,
      };
      const text = details.repositories
        .map(
          (repo) =>
            `${repo.name}${repo.private ? " private" : ""}${repo.language ? ` ${repo.language}` : ""}\n${repo.description ?? ""}\nstars: ${repo.stargazersCount ?? 0} forks: ${repo.forksCount ?? 0}`,
        )
        .join("\n\n");
      return textResult(text || "No repositories", details);
    },
  };
}

async function listRepositories(
  client: GitHubClient,
  cwd: string,
  params: {
    pattern?: string;
    organization?: string;
    language?: string;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
): Promise<Repo[]> {
  const limit = params.limit ?? 30;
  const offset = params.offset ?? 0;
  const page = String(Math.floor(offset / limit) + 1);
  const perPage = String(Math.min(limit, 100));

  if (!params.pattern) {
    const endpoint = params.organization
      ? `orgs/${params.organization}/repos`
      : "user/repos";
    const fields: Record<string, string> = params.organization
      ? { per_page: perPage, page, sort: "updated" }
      : {
          per_page: perPage,
          page,
          sort: "updated",
          affiliation: "owner,collaborator,organization_member",
        };
    const repos = parseJson<Repo[]>(
      await client.api(endpoint, cwd, { method: "GET", fields, signal }),
    );
    return filterRepos(repos, params);
  }

  const query = [`${params.pattern} in:name`];
  if (params.organization) query.push(`org:${params.organization}`);
  if (params.language) query.push(`language:${params.language}`);
  const response = parseJson<SearchResponse>(
    await client.api("search/repositories", cwd, {
      method: "GET",
      fields: {
        q: query.join(" "),
        per_page: perPage,
        page,
        sort: "stars",
        order: "desc",
      },
      signal,
    }),
  );
  return response.items ?? [];
}

function filterRepos(
  repos: Repo[],
  params: { organization?: string; language?: string },
): Repo[] {
  return repos.filter((repo) => {
    if (params.organization) {
      const owner = repo.full_name.split("/")[0]?.toLowerCase();
      if (owner !== params.organization.toLowerCase()) return false;
    }
    if (
      params.language &&
      repo.language?.toLowerCase() !== params.language.toLowerCase()
    ) {
      return false;
    }
    return true;
  });
}

function formatRepo(repo: Repo) {
  return {
    name: repo.full_name,
    description: repo.description,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    private: repo.private,
  };
}
