import type { SubagentToolSpec } from "@harness/agent-kit/types";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createGitDiffTool } from "./git-diff";

export function createReviewerTools(pi: ExtensionAPI): SubagentToolSpec[] {
  return [
    {
      name: "git_diff",
      type: "custom",
      spec: (cwd) => createGitDiffTool(pi, cwd),
    },
  ];
}
