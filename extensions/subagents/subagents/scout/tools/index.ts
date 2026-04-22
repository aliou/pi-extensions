/**
 * Scout subagent tools.
 */

import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { cloneRepoTool } from "./clone-repo";
import { downloadGistTool } from "./download-gist";
import { githubCommitsTool } from "./github-commits";
import { githubCompareTool } from "./github-compare";
import { githubContentTool } from "./github-content";
import { githubIssueTool } from "./github-issue";
import { githubIssuesTool } from "./github-issues";
import { githubPrDiffTool } from "./github-pr-diff";
import { githubPrReviewsTool } from "./github-pr-reviews";
import { githubSearchTool } from "./github-search";
import { listUserReposTool } from "./list-user-repos";
import { repoReadTool } from "./repo-read";
import { uploadGistTool } from "./upload-gist";
import { webFetchTool } from "./web-fetch";
import { webSearchTool } from "./web-search";

/** Create scout tools array */
export function createScoutTools(): ToolDefinition[] {
  return [
    webSearchTool,
    webFetchTool,
    githubContentTool,
    githubSearchTool,
    githubCommitsTool,
    githubIssueTool,
    githubIssuesTool,
    githubPrDiffTool,
    githubPrReviewsTool,
    githubCompareTool,
    listUserReposTool,
    downloadGistTool,
    uploadGistTool,
    cloneRepoTool,
    repoReadTool,
  ] as unknown as ToolDefinition[];
}

export {
  cloneRepoTool,
  downloadGistTool,
  githubCommitsTool,
  githubCompareTool,
  githubContentTool,
  githubIssueTool,
  githubIssuesTool,
  githubPrDiffTool,
  githubPrReviewsTool,
  githubSearchTool,
  listUserReposTool,
  repoReadTool,
  uploadGistTool,
  webFetchTool,
  webSearchTool,
};
