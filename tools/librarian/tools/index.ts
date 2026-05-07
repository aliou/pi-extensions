import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { createGitHubClient } from "../lib/github-client";
import { createCommitSearchTool } from "./commit-search";
import { createDiffTool } from "./diff";
import { createGlobGitHubTool } from "./glob-github";
import { createListDirectoryGitHubTool } from "./list-directory-github";
import { createListRepositoriesTool } from "./list-repositories";
import { createReadGitHubTool } from "./read-github";
import { createSearchGitHubTool } from "./search-github";

export function createLibrarianGitHubTools(
  pi: ExtensionAPI,
): SubagentToolSpec[] {
  const client = createGitHubClient(pi);

  return [
    {
      name: "read_github",
      type: "custom",
      spec: (cwd) => createReadGitHubTool(client, cwd),
    },
    {
      name: "search_github",
      type: "custom",
      spec: (cwd) => createSearchGitHubTool(client, cwd),
    },
    {
      name: "commit_search",
      type: "custom",
      spec: (cwd) => createCommitSearchTool(client, cwd),
    },
    {
      name: "diff",
      type: "custom",
      spec: (cwd) => createDiffTool(client, cwd),
    },
    {
      name: "list_directory_github",
      type: "custom",
      spec: (cwd) => createListDirectoryGitHubTool(client, cwd),
    },
    {
      name: "list_repositories",
      type: "custom",
      spec: (cwd) => createListRepositoriesTool(client, cwd),
    },
    {
      name: "glob_github",
      type: "custom",
      spec: (cwd) => createGlobGitHubTool(client, cwd),
    },
  ];
}
