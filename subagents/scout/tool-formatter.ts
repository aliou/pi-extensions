/**
 * Format scout tool calls for display.
 */

import {
  getToolResultDetails,
  type SubagentToolCall,
} from "@subagents/lib/types";

export interface FormattedToolCall {
  label: string;
  detail?: string;
}

/**
 * Format a scout tool call for display.
 *
 * Examples:
 * - web_fetch: "Fetch example.com/path via exa"
 * - web_search: "Search 'typescript best practices' via exa"
 * - github_content: "Content owner/repo/path"
 * - github_search: "Search 'query'"
 * - github_commits: "Commits owner/repo" or "Diff abc1234"
 * - github_issue: "Issue owner/repo#123"
 * - github_issues: "Issues owner/repo (open, pr)"
 * - github_pr_diff: "PR Diff owner/repo#123"
 * - github_pr_reviews: "PR Reviews owner/repo#123"
 * - github_compare: "Compare owner/repo main...feature"
 */
export function formatScoutToolCall(
  toolCall: SubagentToolCall,
): FormattedToolCall {
  const { toolName, args } = toolCall;

  let formatted: FormattedToolCall;

  switch (toolName) {
    case "web_fetch": {
      const url = args.url as string | undefined;
      const provider = getProviderFromToolCall(toolCall);
      if (url) {
        try {
          const parsed = new URL(url);
          formatted = {
            label: "Fetch",
            detail: withProvider(parsed.hostname + parsed.pathname, provider),
          };
        } catch {
          formatted = { label: "Fetch", detail: withProvider(url, provider) };
        }
      } else {
        formatted = {
          label: "Fetch",
          detail: withProvider(undefined, provider),
        };
      }
      break;
    }

    case "web_search": {
      const query = args.query as string | undefined;
      const provider = getProviderFromToolCall(toolCall);
      formatted = {
        label: "Search",
        detail: withProvider(query ? `'${query}'` : undefined, provider),
      };
      break;
    }

    case "github_content": {
      const repo = args.repo as string | undefined;
      const path = args.path as string | undefined;
      if (repo) {
        // Extract owner/repo from URL or use as-is
        let repoName = repo;
        try {
          const parsed = new URL(repo);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            repoName = `${parts[0]}/${parts[1]}`;
          }
        } catch {
          // Not a URL, use as-is
        }
        const detail = path ? `${repoName}/${path}` : repoName;
        formatted = { label: "Content", detail };
      } else {
        formatted = { label: "Content" };
      }
      break;
    }

    case "github_search": {
      const query = args.query as string | undefined;
      const repo = args.repo as string | undefined;
      let detail = query ? `'${query}'` : undefined;
      if (repo && detail) {
        detail += ` in ${repo}`;
      }
      formatted = { label: "Code Search", detail };
      break;
    }

    case "github_commits": {
      const repo = args.repo as string | undefined;
      const sha = args.sha as string | undefined;
      if (sha) {
        formatted = { label: "Diff", detail: sha.slice(0, 7) };
      } else if (repo) {
        // Extract owner/repo from URL or use as-is
        let repoName = repo;
        try {
          const parsed = new URL(repo);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            repoName = `${parts[0]}/${parts[1]}`;
          }
        } catch {
          // Not a URL, use as-is
        }
        formatted = { label: "Commits", detail: repoName };
      } else {
        formatted = { label: "Commits" };
      }
      break;
    }

    case "github_issue": {
      const repo = args.repo as string | undefined;
      const number = args.number as number | undefined;
      if (repo && number) {
        // Extract owner/repo from URL or use as-is
        let repoName = repo;
        try {
          const parsed = new URL(repo);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            repoName = `${parts[0]}/${parts[1]}`;
          }
        } catch {
          // Not a URL, use as-is
        }
        formatted = { label: "Issue", detail: `${repoName}#${number}` };
      } else {
        formatted = { label: "Issue" };
      }
      break;
    }

    case "github_issues": {
      const repo = args.repo as string | undefined;
      const state = args.state as string | undefined;
      const type = args.type as string | undefined;
      if (repo) {
        let repoName = repo;
        try {
          const parsed = new URL(repo);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            repoName = `${parts[0]}/${parts[1]}`;
          }
        } catch {
          // Not a URL, use as-is
        }
        const filters: string[] = [];
        if (state && state !== "open") {
          filters.push(state);
        }
        if (type && type !== "all") {
          filters.push(type);
        }
        const detail =
          filters.length > 0 ? `${repoName} (${filters.join(", ")})` : repoName;
        formatted = { label: "Issues", detail };
      } else {
        formatted = { label: "Issues" };
      }
      break;
    }

    case "github_pr_diff": {
      const repo = args.repo as string | undefined;
      const number = args.number as number | undefined;
      if (repo && number) {
        let repoName = repo;
        try {
          const parsed = new URL(repo);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            repoName = `${parts[0]}/${parts[1]}`;
          }
        } catch {
          // Not a URL, use as-is
        }
        formatted = { label: "PR Diff", detail: `${repoName}#${number}` };
      } else {
        formatted = { label: "PR Diff" };
      }
      break;
    }

    case "github_pr_reviews": {
      const repo = args.repo as string | undefined;
      const number = args.number as number | undefined;
      if (repo && number) {
        let repoName = repo;
        try {
          const parsed = new URL(repo);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            repoName = `${parts[0]}/${parts[1]}`;
          }
        } catch {
          // Not a URL, use as-is
        }
        formatted = { label: "PR Reviews", detail: `${repoName}#${number}` };
      } else {
        formatted = { label: "PR Reviews" };
      }
      break;
    }

    case "github_compare": {
      const repo = args.repo as string | undefined;
      const base = args.base as string | undefined;
      const head = args.head as string | undefined;
      if (repo && base && head) {
        let repoName = repo;
        try {
          const parsed = new URL(repo);
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            repoName = `${parts[0]}/${parts[1]}`;
          }
        } catch {
          // Not a URL, use as-is
        }
        formatted = {
          label: "Compare",
          detail: `${repoName} ${base}...${head}`,
        };
      } else {
        formatted = { label: "Compare" };
      }
      break;
    }

    case "list_user_repos": {
      const username = args.username as string | undefined;
      const language = args.language as string | undefined;
      const namePrefix = args.namePrefix as string | undefined;
      if (username) {
        let detail = `@${username}`;
        const filters: string[] = [];
        if (language) {
          filters.push(language);
        }
        if (namePrefix) {
          filters.push(`${namePrefix}*`);
        }
        if (filters.length > 0) {
          detail += ` (${filters.join(", ")})`;
        }
        formatted = { label: "List Repos", detail };
      } else {
        formatted = { label: "List Repos" };
      }
      break;
    }

    case "download_gist": {
      const gist = args.gist as string | undefined;
      formatted = { label: "Download Gist", detail: gist };
      break;
    }

    case "upload_gist": {
      const gist = args.gist as string | undefined;
      formatted = { label: "Upload Gist", detail: gist };
      break;
    }

    default:
      formatted = { label: toolName };
      break;
  }

  return appendDurationToDetail(formatted, toolCall.durationMs);
}

function getProviderFromToolCall(
  toolCall: SubagentToolCall,
): string | undefined {
  const details = getToolResultDetails(toolCall.result);
  return typeof details?.provider === "string" ? details.provider : undefined;
}

function withProvider(
  detail: string | undefined,
  provider: string | undefined,
): string | undefined {
  if (!provider) return detail;
  if (!detail) return `via ${provider}`;
  return `${detail} via ${provider}`;
}

function appendDurationToDetail(
  formatted: FormattedToolCall,
  durationMs?: number,
): FormattedToolCall {
  if (durationMs === undefined) return formatted;

  const duration = formatDuration(durationMs);
  return {
    ...formatted,
    detail: formatted.detail ? `${formatted.detail} · ${duration}` : duration,
  };
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}
