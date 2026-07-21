// biome-ignore lint/plugin: direct child_process usage is required in this helper where ExtensionAPI is unavailable.
import { spawn } from "node:child_process";
import type { HandlerData, ReadUrlHandler } from "./types";

interface NpmUrlInfo {
  packageName: string;
  version?: string;
}

interface NpmPerson {
  name?: string;
  email?: string;
  url?: string;
}

interface NpmRepository {
  type?: string;
  url?: string;
}

interface NpmBugs {
  url?: string;
  email?: string;
}

interface NpmDist {
  tarball?: string;
  shasum?: string;
  integrity?: string;
  fileCount?: number;
  unpackedSize?: number;
}

export interface NpmMetadata {
  name: string;
  version: string;
  description?: string | null;
  license?: string | null;
  author?: string | NpmPerson | null;
  homepage?: string | null;
  repository?: NpmRepository | string | null;
  bugs?: NpmBugs | null;
  keywords?: string[];
  main?: string | null;
  module?: string | null;
  types?: string | null;
  typings?: string | null;
  bin?: Record<string, string> | string | null;
  engines?: Record<string, string> | null;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  dist?: NpmDist;
  "dist-tags"?: Record<string, string>;
  maintainers?: Array<string | NpmPerson>;
  time?: Record<string, string>;
  versions?: string[];
}

interface NpmErrorResponse {
  error?: {
    code?: string;
    summary?: string;
    detail?: string;
  };
}

const README_CHAR_LIMIT = 20_000;
const DEPENDENCY_LIMIT = 30;

export function createNpmHandler(): ReadUrlHandler {
  return {
    name: "npm",
    matches(url: URL): boolean {
      return parseNpmUrl(url) !== null;
    },
    async fetchData(
      url: URL,
      signal: AbortSignal | undefined,
    ): Promise<HandlerData> {
      const info = parseNpmUrl(url);
      if (!info) {
        throw new Error(`Unsupported npm URL: ${url.toString()}`);
      }

      return fetchNpmMarkdown(info, url, signal);
    },
  };
}

export function parseNpmUrl(url: URL): NpmUrlInfo | null {
  const host = normalizeHost(url.hostname);
  if (host !== "npmjs.com") return null;

  const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
  if (parts[0] !== "package" || parts.length < 2) return null;

  const firstSegment = parts[1];
  if (!firstSegment) return null;

  let packageName: string;
  let rest: string[];

  if (firstSegment.startsWith("@")) {
    const nameSegment = parts[2];
    if (!nameSegment) return null;
    packageName = `${firstSegment}/${nameSegment}`;
    rest = parts.slice(3);
  } else {
    packageName = firstSegment;
    rest = parts.slice(2);
  }

  let version: string | undefined;
  if (rest[0] === "v") {
    const versionSegment = rest[1];
    if (versionSegment) {
      version = versionSegment;
    }
  }

  return { packageName, version };
}

export function buildNpmMarkdown(
  meta: NpmMetadata,
  readme: string,
  info: NpmUrlInfo,
  sourceUrl: string,
): string {
  const latestTag = meta["dist-tags"]?.latest;
  const versionSuffix =
    latestTag && latestTag !== meta.version
      ? `${meta.version} (latest: ${latestTag})`
      : meta.version;

  const lines: string[] = [`# ${meta.name}`, ""];

  const metaLines = buildMetaLines(meta, versionSuffix, sourceUrl);
  if (metaLines.length > 0) {
    lines.push(...metaLines, "");
  }

  if (readme.trim()) {
    lines.push(
      "## README",
      "",
      truncateForMarkdown(readme, README_CHAR_LIMIT),
      "",
    );
  } else if (meta.description?.trim()) {
    lines.push("## Description", "", meta.description.trim(), "");
  } else {
    lines.push("_No README or description available._", "");
  }

  const depSections = buildDependencySections(meta);
  if (depSections.length > 0) {
    lines.push(...depSections);
  }

  if (meta.scripts && Object.keys(meta.scripts).length > 0) {
    lines.push(...buildScriptsSection(meta.scripts));
  }

  lines.push("## More via npm", "");
  lines.push(
    npmCommandBlock([
      `npm view ${info.packageName}`,
      `npm view ${info.packageName} readme`,
      ...(info.version
        ? [`npm view ${info.packageName}@${info.version}`]
        : [`npm view ${info.packageName} versions --json`]),
    ]),
  );

  return lines.join("\n").trimEnd();
}

function buildMetaLines(
  meta: NpmMetadata,
  versionSuffix: string,
  sourceUrl: string,
): string[] {
  const lines: string[] = [`- Version: ${versionSuffix}`];

  if (meta.license?.trim()) {
    lines.push(`- License: ${meta.license.trim()}`);
  }

  const author = formatAuthor(meta.author);
  if (author) {
    lines.push(`- Author: ${author}`);
  }

  if (meta.homepage?.trim()) {
    lines.push(`- Homepage: ${meta.homepage.trim()}`);
  }

  const repoUrl = formatRepository(meta.repository);
  if (repoUrl) {
    lines.push(`- Repository: ${repoUrl}`);
  }

  const bugsUrl = typeof meta.bugs === "object" ? meta.bugs?.url : undefined;
  if (bugsUrl?.trim()) {
    lines.push(`- Issues: ${bugsUrl.trim()}`);
  }

  const published = meta.time?.[meta.version];
  if (published) {
    lines.push(`- Published: ${published}`);
  }

  if (meta.dist?.unpackedSize != null) {
    const size = formatBytes(meta.dist.unpackedSize);
    const fileCount = meta.dist.fileCount;
    lines.push(
      `- Size: ${size}${fileCount != null ? ` (${fileCount} files)` : ""}`,
    );
  }

  if (meta.dist?.tarball) {
    lines.push(`- Tarball: ${meta.dist.tarball}`);
  }

  const keywords = meta.keywords?.filter(Boolean) ?? [];
  if (keywords.length > 0) {
    lines.push(`- Keywords: ${keywords.join(", ")}`);
  }

  const entryPoints = formatEntryPoints(meta);
  if (entryPoints) {
    lines.push(`- Entry: ${entryPoints}`);
  }

  const bin = formatBin(meta.bin);
  if (bin) {
    lines.push(`- Bin: ${bin}`);
  }

  const engines = formatEngines(meta.engines);
  if (engines) {
    lines.push(`- Engines: ${engines}`);
  }

  lines.push(`- npm: ${sourceUrl}`);

  return lines;
}

function buildDependencySections(meta: NpmMetadata): string[] {
  const sections: Array<[string, Record<string, string> | undefined]> = [
    ["Dependencies", meta.dependencies],
    ["Peer Dependencies", meta.peerDependencies],
    ["Optional Dependencies", meta.optionalDependencies],
    ["Dev Dependencies", meta.devDependencies],
  ];

  const lines: string[] = [];
  for (const [label, deps] of sections) {
    if (!deps || Object.keys(deps).length === 0) continue;
    lines.push(`## ${label} (${Object.keys(deps).length})`, "");
    lines.push(...formatDependencyList(deps), "");
  }

  return lines;
}

function formatDependencyList(deps: Record<string, string>): string[] {
  const entries = Object.entries(deps);
  const visible = entries.slice(0, DEPENDENCY_LIMIT);
  const lines = visible.map(([name, version]) => `- \`${name}\`: ${version}`);

  if (entries.length > visible.length) {
    lines.push(
      `_${visible.length} of ${entries.length} shown. Run \`npm view\` for the full list._`,
    );
  }

  return lines;
}

function buildScriptsSection(scripts: Record<string, string>): string[] {
  const entries = Object.entries(scripts);
  const lines = ["## Scripts", ""];
  for (const [name, command] of entries) {
    lines.push(`- \`${name}\`: ${command}`);
  }
  lines.push("");
  return lines;
}

async function fetchNpmMarkdown(
  info: NpmUrlInfo,
  url: URL,
  signal: AbortSignal | undefined,
): Promise<HandlerData> {
  const spec = info.version
    ? `${info.packageName}@${info.version}`
    : info.packageName;

  const meta = await fetchNpmMetadata(spec, signal);
  const readme = await fetchNpmReadme(spec, signal).catch(() => "");
  const markdown = buildNpmMarkdown(meta, readme, info, url.toString());

  return {
    sourceUrl: url.toString(),
    title: `${meta.name}@${meta.version}`,
    markdown,
    statusCode: 200,
    statusText: "OK",
  };
}

async function fetchNpmMetadata(
  spec: string,
  signal: AbortSignal | undefined,
): Promise<NpmMetadata> {
  const output = await runNpm(["view", spec, "--json"], signal);

  let parsed: NpmMetadata & NpmErrorResponse;
  try {
    parsed = JSON.parse(output) as NpmMetadata & NpmErrorResponse;
  } catch (_error) {
    void _error;
    throw new Error("Invalid JSON response from `npm view`");
  }

  if (parsed.error) {
    const message =
      parsed.error.summary?.trim() ||
      parsed.error.detail?.trim() ||
      `npm error: ${parsed.error.code ?? "unknown"}`;
    throw new Error(message);
  }

  if (!parsed.name || !parsed.version) {
    throw new Error("`npm view` response missing name or version");
  }

  return parsed;
}

async function fetchNpmReadme(
  spec: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  const output = await runNpm(["view", spec, "readme"], signal);
  return output.trim();
}

async function runNpm(
  args: string[],
  signal: AbortSignal | undefined,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, {
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

      // npm emits JSON error bodies on stdout for 404s and missing versions.
      const parsedError = parseNpmStdoutError(stdout);
      if (parsedError) {
        reject(new Error(parsedError));
        return;
      }

      reject(new Error(stderr.trim() || `npm exited with code ${code}`));
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }

      if (error.code === "ENOENT") {
        reject(new Error("npm CLI is not installed"));
        return;
      }

      reject(error);
    });
  });
}

function parseNpmStdoutError(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as NpmErrorResponse;
    if (!parsed.error) return null;
    return (
      parsed.error.summary?.trim() ||
      parsed.error.detail?.trim() ||
      `npm error: ${parsed.error.code ?? "unknown"}`
    );
  } catch (_error) {
    void _error;
    return null;
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function truncateForMarkdown(text: string, limit: number): string {
  const normalized = text.trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}\n\n_[truncated for token safety]_`;
}

function formatAuthor(author: NpmMetadata["author"]): string | undefined {
  if (!author) return undefined;
  if (typeof author === "string") return author.trim() || undefined;
  const parts = [author.name, author.email && `<${author.email}>`].filter(
    Boolean,
  );
  return parts.join(" ").trim() || undefined;
}

function formatRepository(repo: NpmMetadata["repository"]): string | undefined {
  if (!repo) return undefined;
  const raw = typeof repo === "string" ? repo : repo.url;
  if (!raw) return undefined;
  return normalizeGitUrl(raw);
}

function normalizeGitUrl(url: string): string {
  return url
    .replace(/^git\+/, "")
    .replace(/^git:/, "https:")
    .replace(/\.git$/, "");
}

function formatEntryPoints(meta: NpmMetadata): string | undefined {
  const parts: string[] = [];
  if (meta.main) parts.push(`main=${meta.main}`);
  if (meta.module) parts.push(`module=${meta.module}`);
  const types = meta.types ?? meta.typings;
  if (types) parts.push(`types=${types}`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function formatBin(bin: NpmMetadata["bin"]): string | undefined {
  if (!bin) return undefined;
  if (typeof bin === "string") return bin;
  const entries = Object.entries(bin);
  if (entries.length === 0) return undefined;
  return entries.map(([name, path]) => `${name} -> ${path}`).join(", ");
}

function formatEngines(engines: NpmMetadata["engines"]): string | undefined {
  if (!engines) return undefined;
  const entries = Object.entries(engines);
  if (entries.length === 0) return undefined;
  return entries.map(([name, range]) => `${name}: ${range}`).join(", ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function npmCommandBlock(commands: string[]): string {
  return ["```bash", ...commands, "```"].join("\n");
}
