import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { librarianToolRenderers } from "../render";
import { createCheckoutRepoTool } from "./checkout-repo";
import { createGitLogTool } from "./git-log";
import { createGitShowTool } from "./git-show";
import { createLibrarianGitHubTools } from "./github";

/**
 * Local-first tools for the Librarian subagent.
 *
 * Uses checkout_repo + native tools (ls, find, grep, read) for code
 * exploration, and git_log/git_show for history and diffs.
 */
export function createLibrarianTools(pi: ExtensionAPI): SubagentToolSpec[] {
  return [
    // Custom tools — repo checkout and git history
    {
      name: "checkout_repo",
      type: "custom",
      spec: (cwd) => createCheckoutRepoTool(pi, cwd),
      render: librarianToolRenderers.checkout_repo,
    },
    {
      name: "git_log",
      type: "custom",
      spec: (cwd) => createGitLogTool(pi, cwd),
      render: librarianToolRenderers.git_log,
    },
    {
      name: "git_show",
      type: "custom",
      spec: (cwd) => createGitShowTool(pi, cwd),
      render: librarianToolRenderers.git_show,
    },

    // GitHub discovery tools — find repos before cloning
    ...createLibrarianGitHubTools(pi),

    // Native tools — exploration and code reading
    { name: "ls", type: "native", render: librarianToolRenderers.ls },
    { name: "read", type: "native", render: librarianToolRenderers.read },
    { name: "find", type: "native", render: librarianToolRenderers.find },
    { name: "grep", type: "native", render: librarianToolRenderers.grep },
  ];
}
