/**
 * Resolve the project's default (main) branch at runtime from git config.
 *
 * Order: origin/HEAD symbolic-ref -> init.defaultBranch -> "main".
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Resolve the default branch name, or undefined if not a git repo. */
export async function resolveMainBranch(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | undefined> {
  // 1. origin/HEAD symbolic-ref -> "origin/main" -> "main"
  const head = await pi.exec(
    "git",
    ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    { cwd },
  );
  if (head.code === 0) {
    const ref = head.stdout.trim();
    if (ref.startsWith("origin/")) return ref.slice("origin/".length);
    if (ref) return ref;
  }

  // 2. init.defaultBranch
  const configured = await pi.exec(
    "git",
    ["config", "--get", "init.defaultBranch"],
    { cwd },
  );
  if (configured.code === 0 && configured.stdout.trim()) {
    return configured.stdout.trim();
  }

  // 3. Is it even a git repo? If rev-parse fails, bail.
  const revParse = await pi.exec(
    "git",
    ["rev-parse", "--is-inside-work-tree"],
    {
      cwd,
    },
  );
  if (revParse.code !== 0) return undefined;

  return "main";
}
