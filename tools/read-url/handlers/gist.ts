import { spawn } from "node:child_process";
import { detectCodeFenceLanguage } from "./github";
import type { HandlerData, ReadUrlHandler } from "./types";

interface GistFile {
  filename?: string;
  type?: string;
  language?: string | null;
  content?: string;
  raw_url?: string;
  size?: number;
}

interface GistResponse {
  id: string;
  description: string | null;
  html_url: string;
  files: Record<string, GistFile>;
  public: boolean;
  created_at: string;
  updated_at: string;
  owner?: {
    login?: string;
    html_url?: string;
  } | null;
}

interface GistUrlInfo {
  gistId: string;
}

const GIST_FILE_LIMIT = 10;
const GIST_CHAR_LIMIT = 20000;

export function createGistHandler(): ReadUrlHandler {
  return {
    name: "gist",
    matches(url: URL): boolean {
      return parseGistUrl(url) !== null;
    },
    async fetchData(
      url: URL,
      signal: AbortSignal | undefined,
    ): Promise<HandlerData> {
      const info = parseGistUrl(url);
      if (!info) {
        throw new Error(`Unsupported Gist URL: ${url.toString()}`);
      }

      return fetchGistMarkdown(info, url, signal);
    },
  };
}

export function parseGistUrl(url: URL): GistUrlInfo | null {
  const host = normalizeHost(url.hostname);
  if (host !== "gist.github.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 1) return null;

  const gistId = parts[parts.length - 1];
  if (!gistId || !/^[a-f0-9]+$/i.test(gistId)) return null;

  return { gistId };
}

async function fetchGistMarkdown(
  info: GistUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  const gist = await ghApi<GistResponse>(`/gists/${info.gistId}`, signal);
  const files = Object.entries(gist.files);
  const visibleFiles = files.slice(0, GIST_FILE_LIMIT);
  const owner = gist.owner?.login ? ` by @${gist.owner.login}` : "";
  const title = gist.description?.trim() || `Gist ${gist.id}`;

  const lines = [
    `# ${title}`,
    "",
    `- Gist ID: ${gist.id}`,
    `- Visibility: ${gist.public ? "public" : "secret"}`,
    `- Created: ${gist.created_at}`,
    `- Updated: ${gist.updated_at}`,
    `- URL: ${gist.html_url}`,
    owner ? `- Owner: ${owner.trim()}` : "",
    "",
    `## Files (${files.length})`,
    "",
  ].filter(Boolean);

  if (visibleFiles.length === 0) {
    lines.push("_No files found._", "");
  } else {
    for (const [fallbackName, file] of visibleFiles) {
      const filename = file.filename ?? fallbackName;
      const language = detectCodeFenceLanguage(filename);
      const body = truncateForMarkdown(file.content, GIST_CHAR_LIMIT);
      lines.push(
        `### ${filename}`,
        "",
        `- Type: ${file.type ?? "unknown"}`,
        ...(file.size != null ? [`- Size: ${file.size} bytes`] : []),
        ...(file.raw_url ? [`- Raw: ${file.raw_url}`] : []),
        "",
        `\`\`\`${language}`,
        body,
        "```",
        "",
      );
    }
  }

  if (files.length > visibleFiles.length) {
    lines.push(
      `_Showing ${visibleFiles.length} of ${files.length} files to stay token-conscious._`,
      "",
    );
  }

  lines.push(
    "## Clone locally",
    "",
    "Because gists are Git repositories, you can clone this gist into a temporary directory when you need to inspect or modify it locally:",
    "",
    ghCommandBlock([
      'tmpdir="$(mktemp -d)"',
      `git clone ${gist.html_url}.git "$tmpdir/${gist.id}"`,
      `echo "$tmpdir/${gist.id}"`,
    ]),
    "",
    "## More via gh",
    "",
    ghCommandBlock([`gh api gists/${info.gistId}`]),
  );

  return {
    sourceUrl: url.toString(),
    title,
    markdown: lines.join("\n").trimEnd(),
    statusCode: 200,
    statusText: "OK",
  };
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

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\//, "");
}

function truncateForMarkdown(text: string | undefined, limit: number): string {
  const normalized = (text ?? "").trimEnd();
  if (!normalized) {
    return "_Empty file._";
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}\n\n_[truncated for token safety]_`;
}

function ghCommandBlock(commands: string[]): string {
  return ["```bash", ...commands, "```"].join("\n");
}
