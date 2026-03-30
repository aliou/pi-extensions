/**
 * Scout subagent tools.
 */

import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { downloadGistTool } from "@subagents/scout/tools/download-gist";
import { githubCommitsTool } from "@subagents/scout/tools/github-commits";
import { githubCompareTool } from "@subagents/scout/tools/github-compare";
import { githubContentTool } from "@subagents/scout/tools/github-content";
import { githubIssueTool } from "@subagents/scout/tools/github-issue";
import { githubIssuesTool } from "@subagents/scout/tools/github-issues";
import { githubPrDiffTool } from "@subagents/scout/tools/github-pr-diff";
import { githubPrReviewsTool } from "@subagents/scout/tools/github-pr-reviews";
import { githubSearchTool } from "@subagents/scout/tools/github-search";
import { listUserReposTool } from "@subagents/scout/tools/list-user-repos";
import { uploadGistTool } from "@subagents/scout/tools/upload-gist";
import { webFetchTool } from "@subagents/scout/tools/web-fetch";
import { webSearchTool } from "@subagents/scout/tools/web-search";

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
  ] as unknown as ToolDefinition[];
}

export {
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
  uploadGistTool,
  webFetchTool,
  webSearchTool,
};
