import type {
  SessionEntry,
  SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import { WORKSPACE_METADATA_CUSTOM_TYPE, type WorkspaceRemote } from "./types";

function normalizeRepo(repo: string): string | null {
  let normalized = repo.trim().replace(/^\/+|\/+$/g, "");
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -4);
  }
  return normalized || null;
}

export function parseRemoteUrl(
  url: string,
): Pick<WorkspaceRemote, "host" | "repo"> | null {
  if (/^[A-Za-z]:[\\/]/.test(url)) return null;

  if (url.includes("://")) {
    try {
      const parsed = new URL(url);
      const repo = normalizeRepo(parsed.pathname);
      if (!parsed.hostname || !repo) return null;
      return { host: parsed.hostname, repo };
    } catch {
      return null;
    }
  }

  const scpMatch = url.match(/^(?:[^@/:\s]+@)?([^/:\s]+):(.+)$/);
  if (!scpMatch) return null;

  const host = scpMatch[1];
  const repo = normalizeRepo(scpMatch[2] ?? "");
  if (!host || !repo) return null;
  return { host, repo };
}

export function parseGitRemotes(stdout: string): WorkspaceRemote[] {
  const remotes = new Map<string, WorkspaceRemote>();

  for (const line of stdout.split("\n")) {
    const match = line.trim().match(/^(\S+)\s+(.+)\s+\(fetch\)$/);
    if (!match) continue;

    const name = match[1];
    const parsed = parseRemoteUrl(match[2] ?? "");
    if (!name || !parsed || remotes.has(name)) continue;
    remotes.set(name, { name, ...parsed });
  }

  return [...remotes.values()];
}

export function shouldCaptureWorkspaceMetadata(
  reason: SessionStartEvent["reason"],
  entries: readonly SessionEntry[],
): boolean {
  // Forks inherit historical custom entries, so always append a fresh snapshot.
  if (reason === "new" || reason === "fork") return true;

  // getEntries() covers the whole session tree, not only the active branch.
  return !entries.some(
    (entry) =>
      entry.type === "custom" &&
      entry.customType === WORKSPACE_METADATA_CUSTOM_TYPE,
  );
}
