import { spawn } from "node:child_process";
import { basename, extname } from "node:path";
import type { HandlerData, ReadUrlHandler } from "./types";

interface GitHubRepoResponse {
  full_name?: string;
  description?: string | null;
}

interface GitHubReadmeResponse {
  content?: string;
}

interface GitHubContentResponse {
  content?: string;
  name?: string;
  path?: string;
  type?: string;
  size?: number;
  html_url?: string;
}

interface GitHubDirectoryItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  html_url: string;
}

interface GitHubUser {
  login: string;
  html_url: string;
}

interface GitHubLabel {
  name: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  body: string | null;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  html_url: string;
  pull_request?: { html_url: string };
}

interface GitHubPullRequest {
  number: number;
  title: string;
  state: "open" | "closed";
  body: string | null;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  draft: boolean;
}

interface GitHubComment {
  body: string;
  user: GitHubUser;
  created_at: string;
}

interface GitHubCommitDetail {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

interface GitHubUrlInfo {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
  number?: number;
  sha?: string;
  kind: "repo" | "blob" | "tree" | "issue" | "pull" | "commit";
}

const INLINE_COMMENT_LIMIT = 10;
const DIRECTORY_ITEM_LIMIT = 40;
const COMMIT_FILE_LIMIT = 20;
const BODY_CHAR_LIMIT = 12000;
const COMMENT_CHAR_LIMIT = 4000;

export function createGitHubHandler(): ReadUrlHandler {
  return {
    name: "github",
    matches(url: URL): boolean {
      return (
        normalizeHost(url.hostname) === "github.com" &&
        parseGitHubUrl(url) !== null
      );
    },
    async fetchData(
      url: URL,
      signal: AbortSignal | undefined,
    ): Promise<HandlerData> {
      const info = parseGitHubUrl(url);
      if (!info) {
        throw new Error(`Unsupported GitHub URL: ${url.toString()}`);
      }

      switch (info.kind) {
        case "repo":
          return fetchGitHubRepoMarkdown(info, url, signal);
        case "blob":
          return fetchGitHubBlobMarkdown(info, url, signal);
        case "tree":
          return fetchGitHubTreeMarkdown(info, url, signal);
        case "issue":
          return fetchGitHubIssueMarkdown(info, url, signal);
        case "pull":
          return fetchGitHubPullMarkdown(info, url, signal);
        case "commit":
          return fetchGitHubCommitMarkdown(info, url, signal);
      }
    },
  };
}

export function parseGitHubUrl(url: URL): GitHubUrlInfo | null {
  const host = normalizeHost(url.hostname);
  if (host !== "github.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, repo, section, ...rest] = parts;
  if (!owner || !repo) return null;

  if (!section) {
    return { owner, repo, kind: "repo" };
  }

  if (section === "blob") {
    if (rest.length < 2) return null;
    const [ref, ...pathParts] = rest;
    const path = pathParts.join("/");
    if (!ref || !path) return null;
    return { owner, repo, ref, path, kind: "blob" };
  }

  if (section === "tree") {
    if (rest.length < 1) return null;
    const [ref, ...pathParts] = rest;
    if (!ref) return null;
    return {
      owner,
      repo,
      ref,
      path: pathParts.join("/") || undefined,
      kind: "tree",
    };
  }

  if (section === "issues") {
    const issueNumber = Number.parseInt(rest[0] ?? "", 10);
    if (Number.isNaN(issueNumber)) return null;
    return { owner, repo, number: issueNumber, kind: "issue" };
  }

  if (section === "pull") {
    const prNumber = Number.parseInt(rest[0] ?? "", 10);
    if (Number.isNaN(prNumber)) return null;
    return { owner, repo, number: prNumber, kind: "pull" };
  }

  if (section === "commit") {
    const sha = rest[0];
    if (!sha) return null;
    return { owner, repo, sha, kind: "commit" };
  }

  return { owner, repo, kind: "repo" };
}

async function fetchGitHubRepoMarkdown(
  info: GitHubUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  const repo = await ghApi<GitHubRepoResponse>(
    `/repos/${info.owner}/${info.repo}`,
    signal,
  );

  let readmeMarkdown = "";
  try {
    const readme = await ghApi<GitHubReadmeResponse>(
      `/repos/${info.owner}/${info.repo}/readme`,
      signal,
    );
    const decodedReadme = decodeBase64Utf8(readme.content);
    if (decodedReadme.trim()) {
      readmeMarkdown = decodedReadme.trimEnd();
    }
  } catch {
    // README is optional.
  }

  const repoName = repo.full_name ?? `${info.owner}/${info.repo}`;
  const lines = [`# ${repoName}`, ""];

  if (repo.description?.trim()) {
    lines.push(repo.description.trim(), "");
  }

  if (readmeMarkdown) {
    lines.push(readmeMarkdown, "");
  } else {
    lines.push("_README not found._", "");
  }

  lines.push("## More via gh", "");
  lines.push(
    ghCommandBlock([
      `gh api repos/${info.owner}/${info.repo}`,
      `gh api repos/${info.owner}/${info.repo}/readme | jq -r '.content' | base64 --decode`,
    ]),
  );

  return {
    sourceUrl: url.toString(),
    title: repoName,
    markdown: lines.join("\n").trimEnd(),
    statusCode: 200,
    statusText: "OK",
  };
}

async function fetchGitHubBlobMarkdown(
  info: GitHubUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  if (!info.ref || !info.path) {
    throw new Error(`Invalid GitHub code URL: ${url.toString()}`);
  }

  const encodedPath = encodePath(info.path);
  const content = await ghApi<GitHubContentResponse>(
    `/repos/${info.owner}/${info.repo}/contents/${encodedPath}?ref=${encodeURIComponent(info.ref)}`,
    signal,
  );

  const decoded = decodeBase64Utf8(content.content);
  const filename = content.name ?? basename(info.path);
  const language = detectCodeFenceLanguage(content.path ?? info.path);
  const title = `${info.owner}/${info.repo}:${info.path}`;
  const markdown = [
    `# ${filename}`,
    "",
    `Source: [${info.owner}/${info.repo}@${info.ref}/${info.path}](${url.toString()})`,
    "",
    `\`\`\`${language}`,
    decoded.trimEnd(),
    "```",
    "",
    "## More via gh",
    "",
    ghCommandBlock([
      `gh api repos/${info.owner}/${info.repo}/contents/${encodedPath}?ref=${info.ref}`,
      `gh api repos/${info.owner}/${info.repo}/contents/${encodedPath}?ref=${info.ref} | jq -r '.content' | base64 --decode`,
    ]),
  ].join("\n");

  return {
    sourceUrl: url.toString(),
    title,
    markdown,
    statusCode: 200,
    statusText: "OK",
  };
}

async function fetchGitHubTreeMarkdown(
  info: GitHubUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  if (!info.ref) {
    throw new Error(`Invalid GitHub tree URL: ${url.toString()}`);
  }

  const baseEndpoint = info.path
    ? `/repos/${info.owner}/${info.repo}/contents/${encodePath(info.path)}?ref=${encodeURIComponent(info.ref)}`
    : `/repos/${info.owner}/${info.repo}/contents?ref=${encodeURIComponent(info.ref)}`;

  const items = await ghApi<GitHubDirectoryItem[]>(baseEndpoint, signal);
  const sorted = [...items].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });

  const visibleItems = sorted.slice(0, DIRECTORY_ITEM_LIMIT);
  const titlePath = info.path
    ? `${info.owner}/${info.repo}/${info.path}`
    : `${info.owner}/${info.repo}`;
  const lines = [
    `# ${titlePath}`,
    "",
    `Ref: \`${info.ref}\``,
    "",
    "## Contents",
    "",
  ];

  for (const item of visibleItems) {
    const icon = item.type === "dir" ? "[d]" : "[f]";
    const size = item.type === "file" ? ` (${item.size} bytes)` : "";
    lines.push(`- ${icon} [${item.path}](${item.html_url})${size}`);
  }

  if (sorted.length > visibleItems.length) {
    lines.push(
      "",
      `_Showing ${visibleItems.length} of ${sorted.length} items to stay token-conscious._`,
    );
  }

  lines.push(
    "",
    "## More via gh",
    "",
    ghCommandBlock([`gh api ${stripLeadingSlash(baseEndpoint)}`]),
  );

  return {
    sourceUrl: url.toString(),
    title: titlePath,
    markdown: lines.join("\n").trimEnd(),
    statusCode: 200,
    statusText: "OK",
  };
}

async function fetchGitHubIssueMarkdown(
  info: GitHubUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  if (!info.number) {
    throw new Error(`Invalid GitHub issue URL: ${url.toString()}`);
  }

  const issue = await ghApi<GitHubIssue>(
    `/repos/${info.owner}/${info.repo}/issues/${info.number}`,
    signal,
  );

  if (issue.pull_request) {
    return fetchGitHubPullMarkdown(
      { ...info, kind: "pull", number: issue.number },
      new URL(issue.pull_request.html_url),
      signal,
    );
  }

  const lines = buildIssueLikeHeader({
    kind: "Issue",
    number: issue.number,
    title: issue.title,
    state: issue.state,
    author: issue.user,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    labels: issue.labels,
    assignees: issue.assignees,
    url: issue.html_url,
  });

  lines.push(
    "## Description",
    "",
    truncateForMarkdown(issue.body, BODY_CHAR_LIMIT),
    "",
  );
  lines.push(`## Comments (${issue.comments})`, "");

  if (issue.comments === 0) {
    lines.push("_No comments._", "");
  } else if (issue.comments < INLINE_COMMENT_LIMIT) {
    const comments = await ghApi<GitHubComment[]>(
      `/repos/${info.owner}/${info.repo}/issues/${info.number}/comments?per_page=100`,
      signal,
    );
    lines.push(...formatComments(comments), "");
  } else {
    lines.push(
      `_Too many comments to inline (${issue.comments}). Fetch them only if needed._`,
      "",
    );
  }

  lines.push("## More via gh", "");
  lines.push(
    ghCommandBlock([
      `gh api repos/${info.owner}/${info.repo}/issues/${info.number}`,
      `gh api repos/${info.owner}/${info.repo}/issues/${info.number}/comments --paginate`,
    ]),
  );

  return {
    sourceUrl: url.toString(),
    title: `${info.owner}/${info.repo}#${issue.number}`,
    markdown: lines.join("\n").trimEnd(),
    statusCode: 200,
    statusText: "OK",
  };
}

async function fetchGitHubPullMarkdown(
  info: GitHubUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  if (!info.number) {
    throw new Error(`Invalid GitHub pull request URL: ${url.toString()}`);
  }

  const pr = await ghApi<GitHubPullRequest>(
    `/repos/${info.owner}/${info.repo}/pulls/${info.number}`,
    signal,
  );

  const lines = buildIssueLikeHeader({
    kind: "PR",
    number: pr.number,
    title: pr.title,
    state: pr.merged_at ? "merged" : pr.state,
    author: pr.user,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    closedAt: pr.merged_at ?? pr.closed_at,
    labels: pr.labels,
    assignees: pr.assignees,
    url: pr.html_url,
  });

  lines.push(
    `- Branches: \`${pr.head.ref}\` -> \`${pr.base.ref}\``,
    `- Stats: +${pr.additions} -${pr.deletions} in ${pr.changed_files} files across ${pr.commits} commits${pr.draft ? " (draft)" : ""}`,
    "",
    "## Description",
    "",
    truncateForMarkdown(pr.body, BODY_CHAR_LIMIT),
    "",
    `## Review comments on conversation thread (${pr.comments})`,
    "",
  );

  if (pr.comments === 0) {
    lines.push("_No issue-thread comments._", "");
  } else if (pr.comments < INLINE_COMMENT_LIMIT) {
    const comments = await ghApi<GitHubComment[]>(
      `/repos/${info.owner}/${info.repo}/issues/${info.number}/comments?per_page=100`,
      signal,
    );
    lines.push(...formatComments(comments), "");
  } else {
    lines.push(
      `_Too many issue-thread comments to inline (${pr.comments}). Fetch them only if needed._`,
      "",
    );
  }

  lines.push("## More via gh", "");
  lines.push(
    ghCommandBlock([
      `gh api repos/${info.owner}/${info.repo}/pulls/${info.number}`,
      `gh api repos/${info.owner}/${info.repo}/issues/${info.number}/comments --paginate`,
      `gh api repos/${info.owner}/${info.repo}/pulls/${info.number}/files --paginate`,
      `gh api repos/${info.owner}/${info.repo}/pulls/${info.number}/reviews --paginate`,
    ]),
  );

  return {
    sourceUrl: url.toString(),
    title: `${info.owner}/${info.repo}#${pr.number}`,
    markdown: lines.join("\n").trimEnd(),
    statusCode: 200,
    statusText: "OK",
  };
}

async function fetchGitHubCommitMarkdown(
  info: GitHubUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  if (!info.sha) {
    throw new Error(`Invalid GitHub commit URL: ${url.toString()}`);
  }

  const commit = await ghApi<GitHubCommitDetail>(
    `/repos/${info.owner}/${info.repo}/commits/${info.sha}`,
    signal,
  );

  const files = commit.files ?? [];
  const visibleFiles = files.slice(0, COMMIT_FILE_LIMIT);
  const lines = [
    `# Commit ${commit.sha.slice(0, 12)}`,
    "",
    `- Author: ${commit.commit.author.name}`,
    `- Date: ${commit.commit.author.date}`,
    `- URL: ${commit.html_url}`,
    "",
    "## Message",
    "",
    commit.commit.message.trim(),
    "",
    `## Files (${files.length})`,
    "",
  ];

  if (visibleFiles.length === 0) {
    lines.push("_No file metadata returned._");
  } else {
    for (const file of visibleFiles) {
      lines.push(
        `- ${file.filename} (${file.status}, +${file.additions} -${file.deletions}, ${file.changes} changes)`,
      );
    }
  }

  if (files.length > visibleFiles.length) {
    lines.push(
      "",
      `_Showing ${visibleFiles.length} of ${files.length} files to stay token-conscious._`,
    );
  }

  lines.push(
    "",
    "## More via gh",
    "",
    ghCommandBlock([
      `gh api repos/${info.owner}/${info.repo}/commits/${info.sha}`,
    ]),
  );

  return {
    sourceUrl: url.toString(),
    title: `${info.owner}/${info.repo}@${commit.sha.slice(0, 12)}`,
    markdown: lines.join("\n").trimEnd(),
    statusCode: 200,
    statusText: "OK",
  };
}

function buildIssueLikeHeader(input: {
  kind: "Issue" | "PR";
  number: number;
  title: string;
  state: string;
  author: GitHubUser;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  url: string;
}): string[] {
  const lines = [
    `# ${input.kind} #${input.number}: ${input.title}`,
    "",
    `- State: ${input.state}`,
    `- Author: [@${input.author.login}](${input.author.html_url})`,
    `- Created: ${input.createdAt}`,
    `- Updated: ${input.updatedAt}`,
  ];

  if (input.closedAt) {
    lines.push(`- Closed: ${input.closedAt}`);
  }

  if (input.labels.length > 0) {
    lines.push(
      `- Labels: ${input.labels.map((label) => label.name).join(", ")}`,
    );
  }

  if (input.assignees.length > 0) {
    lines.push(
      `- Assignees: ${input.assignees.map((assignee) => `@${assignee.login}`).join(", ")}`,
    );
  }

  lines.push(`- URL: ${input.url}`, "");
  return lines;
}

function formatComments(comments: GitHubComment[]): string[] {
  if (comments.length === 0) {
    return ["_No comments found._"];
  }

  const lines: string[] = [];
  for (const comment of comments) {
    lines.push(
      `### @${comment.user.login} - ${comment.created_at}`,
      "",
      truncateForMarkdown(comment.body, COMMENT_CHAR_LIMIT),
      "",
      "---",
      "",
    );
  }
  return lines;
}

async function ghApi<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  const output = await runGh(["api", stripLeadingSlash(endpoint)], signal);
  return JSON.parse(output) as T;
}

async function runGh(args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const onAbort = () => {
      child.kill("SIGTERM");
      reject(new Error("Operation aborted"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }

      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `gh exited with code ${code}`));
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }

      if (error.code === "ENOENT") {
        reject(new Error("gh CLI is not installed"));
        return;
      }

      reject(error);
    });
  });
}

function decodeBase64Utf8(value: string | undefined): string {
  if (!value) {
    throw new Error("GitHub API response did not include content");
  }

  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\//, "");
}

function truncateForMarkdown(
  text: string | null | undefined,
  limit: number,
): string {
  const normalized = (text ?? "_No description provided._").trim();
  if (normalized.length <= limit) {
    return normalized || "_No description provided._";
  }

  return `${normalized.slice(0, limit)}\n\n_[truncated for token safety]_`;
}

function ghCommandBlock(commands: string[]): string {
  return ["```bash", ...commands, "```"].join("\n");
}

export function detectCodeFenceLanguage(path: string): string {
  const extension = extname(path).toLowerCase();

  switch (extension) {
    case ".ts":
    case ".mts":
    case ".cts":
      return "ts";
    case ".tsx":
      return "tsx";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "js";
    case ".jsx":
      return "jsx";
    case ".json":
      return "json";
    case ".md":
      return "md";
    case ".py":
      return "python";
    case ".rb":
      return "ruby";
    case ".rs":
      return "rust";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".sh":
      return "bash";
    case ".yml":
    case ".yaml":
      return "yaml";
    default:
      return "text";
  }
}
