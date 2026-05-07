/**
 * Session directory path utilities and approval state.
 */

import { isAbsolute, join, relative, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Approval state (module scope, per Pi runtime)
// ---------------------------------------------------------------------------

let allowAll = false;
const approvedSubtrees = new Set<string>();

/** @internal Reset approval state for testing. */
export function _resetForTesting(): void {
  allowAll = false;
  approvedSubtrees.clear();
}

// ---------------------------------------------------------------------------
// Session dir helpers
// ---------------------------------------------------------------------------

function getSessionsDir(): string {
  return join(getAgentDir(), "sessions");
}

/**
 * Check if a resolved absolute path falls within the sessions directory.
 */
export function isInSessionsDir(path: string): boolean {
  const sessionsDir = getSessionsDir();
  const absolutePath = resolve(path);
  const rel = relative(sessionsDir, absolutePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Check if a path is covered by any approved subtree.
 */
export function isApprovedPath(targetPath: string): boolean {
  if (allowAll) return true;
  for (const approved of approvedSubtrees) {
    const rel = relative(approved, resolve(targetPath));
    if (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)) return true;
  }
  return false;
}

export function getAllowAll(): boolean {
  return allowAll;
}

export function setAllowAll(): void {
  allowAll = true;
}

export function approveSubtree(dir: string): void {
  approvedSubtrees.add(dir);
}
