import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";

export function encodePathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function expandHomePath(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

/** Collapse `$HOME` prefix to `~`. Inverse of `expandHomePath`. */
export function collapseHomePath(path: string): string {
  const home = homedir();
  if (home && path.startsWith(home)) return `~${path.slice(home.length)}`;
  return path;
}

/**
 * Format a path for display: relative to `cwd` when inside it, otherwise the
 * absolute path with the home directory collapsed to `~`.
 */
export function formatDisplayPath(path: string, cwd: string): string {
  if (!path) return path;
  const abs = isAbsolute(path) ? path : join(cwd, path);
  const rel = relative(cwd, abs);
  if (rel === "") return ".";
  if (!rel.startsWith("..") && !isAbsolute(rel)) return rel;
  return collapseHomePath(abs);
}
