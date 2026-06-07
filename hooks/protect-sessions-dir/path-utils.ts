/**
 * Session directory path utilities and approval state.
 */

import { isAbsolute, relative, resolve } from "node:path";
import { isInSessionsDir as _isInSessionsDir } from "@harness/session-store";

// Re-export for local consumers (e.g. gate.ts)
export { _isInSessionsDir as isInSessionsDir };

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
// Session dir re-exports
// ---------------------------------------------------------------------------

// isInSessionsDir is now imported from @harness/session-store.
// getSessionsDir is also available there but not re-exported to avoid
// proliferating direct session-dir access.

// ---------------------------------------------------------------------------
// Approval helpers
// ---------------------------------------------------------------------------

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
