import { homedir } from "node:os";
import { relative } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PROJECTS_ROOT } from "./types";

export interface ProjectInfo {
  /** Relative path from ~/code/src, e.g. github.com/aliou/pi. */
  relPath: string;
  /** Display label, e.g. aliou/pi. */
  label: string;
  /** Tilde path, e.g. ~/code/src/github.com/aliou/pi. */
  tildePath: string;
  /** Zoxide frecency score. */
  score: number;
}

/**
 * List project directories under ~/code/src using zoxide only.
 *
 * zoxide is the candidate source and ranking source. Entries outside ~/code/src
 * are ignored. Results preserve zoxide frecency order, with alpha fallback for
 * ties or malformed score lines.
 */
export async function listProjects(
  pi: ExtensionAPI,
  signal?: AbortSignal,
): Promise<ProjectInfo[]> {
  const home = homedir();
  const basePath = PROJECTS_ROOT.replace(/^~/, home);
  const result = await pi.exec("zoxide", ["query", "-ls"], { signal });

  if (result.code !== 0 || !result.stdout.trim()) {
    return [];
  }

  const projects: ProjectInfo[] = [];

  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\S+)\s+(.+)$/);
    if (!match) continue;

    const score = Number(match[1]);
    const dir = match[2]?.replace(/\/+$/, "");
    if (!dir?.startsWith(`${basePath}/`)) continue;

    const relPath = relative(basePath, dir);
    const tildePath = `~${dir.slice(home.length)}`;
    const segments = relPath.split("/").filter(Boolean);
    const label = segments.slice(-2).join("/") || relPath;

    projects.push({
      relPath,
      label,
      tildePath,
      score: Number.isFinite(score) ? score : 0,
    });
  }

  return projects.sort(
    (a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath),
  );
}
