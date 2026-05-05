import type { Theme } from "@mariozechner/pi-coding-agent";
import { visibleWidth } from "@mariozechner/pi-tui";
import type { GitStatus } from "./git-status";

interface PathPartsResult {
  /** The styled path string (project name only). */
  path: string;
  pathWidth: number;
  /** The styled branch + git status string. Undefined when no branch. */
  branch?: string;
  branchWidth: number;
  /** Total visible width of path + separator + branch. */
  width: number;
}

/**
 * Build path and branch parts for the footer.
 *
 * Path is always the last directory segment (project name).
 * Branch is plain text, no brackets. Main branch is dimmed, others use accent.
 * Git status indicators appended after branch: * (dirty), ⇡N (ahead), ⇣N (behind).
 */
export function buildPathParts(
  theme: Theme,
  branch: string | null | undefined,
  gitStatus?: Readonly<GitStatus>,
): PathPartsResult {
  let cwd = process.cwd();
  const home = process.env.HOME || process.env.USERPROFILE;

  if (home && cwd.startsWith(home)) {
    cwd = cwd.slice(home.length);
  }

  const segments = cwd.split("/").filter((s) => s.length > 0);
  const projectName = segments[segments.length - 1] ?? "";

  const pathPart = projectName;
  const pathWidth = visibleWidth(pathPart);

  let branchPart: string | undefined;
  let branchWidth = 0;
  const separatorWidth = 1; // space between path and branch

  if (branch) {
    const isMainBranch = branch === "main";
    const branchStr = isMainBranch
      ? theme.fg("thinkingMinimal", branch)
      : theme.fg("accent", branch);

    // Build status suffix: " *" for dirty, " ⇡N" for ahead, " ⇣N" for behind
    let suffixStr = "";
    let suffixWidth = 0;
    if (gitStatus) {
      const parts: { text: string; styled: string }[] = [];
      if (gitStatus.dirty)
        parts.push({ text: " *", styled: ` ${theme.fg("warning", "*")}` });
      if (gitStatus.behind > 0) {
        const raw = `⇣${gitStatus.behind}`;
        parts.push({ text: ` ${raw}`, styled: ` ${theme.fg("error", raw)}` });
      }
      if (gitStatus.ahead > 0) {
        const raw = `⇡${gitStatus.ahead}`;
        parts.push({ text: ` ${raw}`, styled: ` ${theme.fg("accent", raw)}` });
      }
      if (parts.length > 0) {
        suffixStr = parts.map((p) => p.styled).join("");
        suffixWidth = parts.reduce((sum, p) => sum + visibleWidth(p.text), 0);
      }
    }

    branchPart = branchStr + suffixStr;
    branchWidth = visibleWidth(branch) + suffixWidth;
  }

  const totalWidth = branchPart
    ? pathWidth + separatorWidth + branchWidth
    : pathWidth;

  return {
    path: pathPart,
    pathWidth,
    branch: branchPart,
    branchWidth,
    width: totalWidth,
  };
}
