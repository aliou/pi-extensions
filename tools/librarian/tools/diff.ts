import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import {
  type GitHubClient,
  normalizeRepository,
  parseJson,
  textResult,
} from "../lib/github-client";

const Params = Type.Object({
  base: Type.String({
    description:
      'The base commit SHA, branch name, or tag to compare from (e.g., "main", "v1.0.0", or commit SHA)',
  }),
  head: Type.String({
    description:
      'The head commit SHA, branch name, or tag to compare to (e.g., "feature-branch", "v2.0.0", or commit SHA)',
  }),
  repository: Type.String({
    description:
      'Single GitHub repository to compare. Use "owner/repo" or "https://github.com/owner/repo". Do not pass GitHub search pages such as "https://github.com/search".',
  }),
  includePatches: Type.Optional(
    Type.Boolean({
      description:
        "Include unified diff patches per file (token heavy, truncated to ~4k characters per file). Default false.",
    }),
  ),
});

interface CompareResponse {
  files?: Array<Record<string, unknown> & { patch?: string }>;
  base_commit?: { sha?: string; commit?: { message?: string } };
  commits?: Array<{ sha?: string; commit?: { message?: string } }>;
  ahead_by?: number;
  behind_by?: number;
  total_commits?: number;
}

export function createDiffTool(
  client: GitHubClient,
  cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "diff",
    label: "GitHub Diff",
    description:
      "Get a diff between two commits, branches, or tags in a single GitHub repository.",
    parameters: Params,
    async execute(_id, params, signal) {
      const repository = normalizeRepository(params.repository);
      const json = await client.api(
        `repos/${repository}/compare/${params.base}...${params.head}`,
        cwd,
        { signal },
      );
      const response = parseJson<CompareResponse>(json);
      const files = (response.files ?? []).map((file) => {
        if (!params.includePatches) {
          const { patch: _patch, ...rest } = file;
          return rest;
        }
        return file.patch && file.patch.length > 4096
          ? { ...file, patch: `${file.patch.slice(0, 4096)}\n... [truncated]` }
          : file;
      });
      const headCommit = response.commits?.[response.commits.length - 1];
      const details = {
        files,
        base_commit: {
          sha: response.base_commit?.sha ?? params.base,
          message: response.base_commit?.commit?.message?.trim() ?? "",
        },
        head_commit: {
          sha: headCommit?.sha ?? params.head,
          message: headCommit?.commit?.message?.trim() ?? "",
        },
        ahead_by: response.ahead_by,
        behind_by: response.behind_by,
        total_commits: response.total_commits,
      };
      const text = [
        `Base: ${details.base_commit.sha} ${details.base_commit.message}`,
        `Head: ${details.head_commit.sha} ${details.head_commit.message}`,
        `Commits: ${details.total_commits ?? 0} ahead: ${details.ahead_by ?? 0} behind: ${details.behind_by ?? 0}`,
        "",
        ...files.map(
          (file) =>
            `${String(file.status)} ${String(file.filename)} (+${String(file.additions)} -${String(file.deletions)})`,
        ),
      ].join("\n");
      return textResult(text, details);
    },
  };
}
