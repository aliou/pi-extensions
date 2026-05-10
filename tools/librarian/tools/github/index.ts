import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { createGitHubClient } from "../../lib/github-client";
import { createListRepositoriesTool } from "./list-repositories";
import { createSearchGitHubTool } from "./search-github";

/**
 * GitHub discovery tools for the Librarian subagent.
 *
 * These complement the local-first tools by helping discover repositories
 * before cloning them with checkout_repo.
 */
export function createLibrarianGitHubTools(
  pi: ExtensionAPI,
): SubagentToolSpec[] {
  const client = createGitHubClient(pi);

  return [
    {
      name: "search_github",
      type: "custom",
      spec: (cwd) => createSearchGitHubTool(client, cwd),
    },
    {
      name: "list_repositories",
      type: "custom",
      spec: (cwd) => createListRepositoriesTool(client, cwd),
    },
  ];
}
