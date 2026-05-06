import { encodePathSegments } from "@harness/utils/path";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import {
  type GitHubClient,
  normalizeRepository,
  parseJson,
  textResult,
} from "../lib/github-client";

const Params = Type.Object({
  path: Type.String({
    description: "Directory path within the selected repository to list",
  }),
  repository: Type.String({
    description:
      'Single GitHub repository to inspect. Use "owner/repo" or "https://github.com/owner/repo". Do not pass GitHub search pages such as "https://github.com/search".',
  }),
  limit: Type.Optional(
    Type.Number({
      description:
        "Maximum number of entries to return (default: 100, max: 1000)",
      minimum: 1,
      maximum: 1000,
    }),
  ),
});

interface Entry {
  name: string;
  type: "file" | "dir" | string;
}

interface FileMetadata {
  type?: string;
}

export function createListDirectoryGitHubTool(
  client: GitHubClient,
  cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "list_directory_github",
    label: "List GitHub Directory",
    description: "List the contents of a directory in a GitHub repository.",
    parameters: Params,
    async execute(_id, params, signal) {
      const repository = normalizeRepository(params.repository);
      const path = params.path === "." ? "" : params.path.replace(/^\//, "");
      const encodedPath = encodePathSegments(path);
      const json = await client.api(
        `repos/${repository}/contents/${encodedPath}`,
        cwd,
        {
          signal,
        },
      );
      const data = parseJson<Entry[] | FileMetadata>(json);
      if (!Array.isArray(data)) {
        throw new Error(
          `Cannot list "${path || "/"}" because GitHub returned ${data.type ?? "file"} metadata instead of a directory listing.`,
        );
      }
      const names = data
        .map((entry) => (entry.type === "dir" ? `${entry.name}/` : entry.name))
        .sort(
          (a, b) =>
            Number(b.endsWith("/")) - Number(a.endsWith("/")) ||
            a.localeCompare(b),
        )
        .slice(0, params.limit ?? 100);
      return textResult(names.join("\n"), { entries: names });
    },
  };
}
