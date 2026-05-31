/**
 * Session search and display helpers.
 */

import type { SearchResult as SesameSearchResult } from "@aliou/sesame";
import type { SesameDb } from "./db";

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
  cwd?: string,
): SesameSearchResult[] {
  const stmt = db.prepare(
    `SELECT id as sessionId, source, path, cwd, name, created_at as createdAt, modified_at as modifiedAt
     FROM sessions
     WHERE (? IS NULL OR cwd LIKE ?) AND name LIKE ?
     ORDER BY modified_at DESC`,
  );
  const cwdFilter = cwd ? `${cwd}%` : null;
  const rows = stmt.all(cwdFilter, cwdFilter, `%${token}%`) as Array<{
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
