/**
 * Session search and display helpers.
 */

import type { SearchResult as SesameSearchResult } from "@aliou/sesame";
import type { SesameDb } from "./db";

/**
 * Relative time string from an ISO date.
 */
export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Collapse `$HOME` prefix to `~`.
 */
export function tildePath(p: string): string {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return `~${p.slice(home.length)}`;
  return p;
}

/**
 * Search sessions by name using SQL LIKE. Fast alternative to FTS for
 * short tokens (avoids 40K+ FTS matches for single characters).
 */
export function searchByName(
  db: SesameDb,
  token: string,
  cwd: string,
  limit: number,
): SesameSearchResult[] {
  const stmt = db.prepare(
    `SELECT id as sessionId, source, path, cwd, name, created_at as createdAt, modified_at as modifiedAt
     FROM sessions
     WHERE cwd LIKE ? AND name LIKE ?
     ORDER BY modified_at DESC
     LIMIT ?`,
  );
  const rows = stmt.all(`${cwd}%`, `%${token}%`, limit) as Array<{
    sessionId: string;
    source: string;
    path: string;
    cwd: string | null;
    name: string | null;
    createdAt: string | null;
    modifiedAt: string | null;
  }>;

  return rows.map((row) => ({
    sessionId: row.sessionId,
    source: row.source,
    path: row.path,
    cwd: row.cwd,
    name: row.name,
    score: 0,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
    matchedSnippet: row.name || "(recent session)",
  }));
}
