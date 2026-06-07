/**
 * Session search and listing using the Sesame indexed search library.
 *
 * Moved from:
 * - breadcrumbs/lib/session-search.ts: searchSessions(), listSessions()
 * - session-autocomplete/db.ts: resolveSessionRefFromDb()
 * - session-autocomplete/search.ts: searchByName()
 *
 * Behavioral changes from breadcrumbs implementation:
 * - listSessions() now queries the DB instead of reading the filesystem.
 * - searchSessions() uses a long-lived DB connection instead of open/close per call.
 * - firstMessage is dropped from SessionResult (not in the sesame DB index).
 * - parseRelativeDate is re-used from @aliou/sesame instead of duplicated.
 */

import { resolve } from "node:path";
import {
  parseRelativeDate,
  type SearchOptions as SesameSearchOptions,
  type SearchResult as SesameSearchResult,
  search,
} from "@aliou/sesame";
import { getDb } from "./db";
import type {
  ListOptions,
  SearchOptions,
  SessionRef,
  SessionResult,
} from "./types";

/** Map our SearchOptions to sesame's SearchOptions. */
function toSesameOptions(options: SearchOptions): SesameSearchOptions {
  const { cwd, after, before, limit } = options;

  return {
    cwd,
    after: toSesameDate(after),
    before: toSesameDate(before),
    limit,
  };
}

/** Convert date filter to sesame library format (ISO date string). */
function toSesameDate(input?: string): string | undefined {
  if (!input) return undefined;

  // Preserve ISO-like input to match previous behavior
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input;
  }

  const parsed = parseRelativeDate(input);
  if (!parsed) return undefined;
  return parsed.length >= 10 ? parsed.slice(0, 10) : parsed;
}

/** Resolve a sesame SearchResult to our SessionResult, fetching messageCount from DB. */
function toSessionResult(r: SesameSearchResult): SessionResult {
  // messageCount comes from the sessions table; fetch it in batch below
  return {
    id: r.sessionId,
    path: r.path,
    cwd: r.cwd ?? "",
    name: r.name ?? undefined,
    created: r.createdAt ?? r.modifiedAt ?? "",
    modified: r.modifiedAt ?? r.createdAt ?? "",
    messageCount: 0, // filled by fillMessageCounts
    matchedSnippet: r.matchedSnippet || undefined,
    score: r.score || undefined,
  };
}

/**
 * Fill messageCount for a batch of results using a single DB query.
 * Mutates the results in place.
 */
function fillMessageCounts(results: SessionResult[]): void {
  if (results.length === 0) return;

  const db = getDb();
  const ids = results.map((r) => r.id);

  // Build a parameterized query for the batch
  const placeholders = ids.map(() => "?").join(",");
  const stmt = db.prepare(
    `SELECT id, message_count FROM sessions WHERE id IN (${placeholders})`,
  );
  const rows = stmt.all(...ids) as Array<{
    id: string;
    message_count: number;
  }>;

  const countMap = new Map(rows.map((row) => [row.id, row.message_count]));
  for (const result of results) {
    const count = countMap.get(result.id);
    if (count !== undefined) {
      result.messageCount = count;
    }
  }
}

/**
 * Search sessions using the Sesame indexed search library.
 * Respects cwd and date filters, returns sorted results up to limit.
 */
export function searchSessions(options: SearchOptions): SessionResult[] {
  const { query } = options;

  if (!query || query.trim() === "") {
    return [];
  }

  const db = getDb();
  const sesameOptions = toSesameOptions(options);
  const rawResults = search(db, query, sesameOptions);

  const results = rawResults.map(toSessionResult);
  fillMessageCounts(results);

  return results;
}

/**
 * List sessions for a given directory (or child directories up to depth).
 *
 * Queries the sesame DB instead of reading the filesystem.
 * The DB is the source of truth.
 */
export function listSessions(options: ListOptions): SessionResult[] {
  const { cwd, limit = 20, depth = 0 } = options;
  const db = getDb();
  const targetResolved = resolve(cwd);

  if (depth > 0) {
    // Match exact cwd and any child paths within depth
    const prefix = `${targetResolved}/`;
    const stmt = db.prepare(
      `SELECT id, path, cwd, name, created_at, modified_at, message_count
       FROM sessions
       WHERE (cwd = ? OR cwd LIKE ?)
       ORDER BY modified_at DESC
       LIMIT ?`,
    );
    const rows = stmt.all(targetResolved, `${prefix}%`, limit * 2) as Array<{
      id: string;
      path: string;
      cwd: string | null;
      name: string | null;
      created_at: string | null;
      modified_at: string | null;
      message_count: number;
    }>;

    // Filter by depth
    const filtered = rows.filter((row) => {
      if (!row.cwd) return false;
      if (row.cwd === targetResolved) return true;
      const relative = row.cwd.slice(targetResolved.length + 1);
      const relativeDepth = relative.split("/").length;
      return relativeDepth <= depth;
    });

    return filtered.slice(0, limit).map((row) => ({
      id: row.id,
      path: row.path,
      cwd: row.cwd || "",
      name: row.name ?? undefined,
      created: row.created_at ?? row.modified_at ?? "",
      modified: row.modified_at ?? row.created_at ?? "",
      messageCount: row.message_count ?? 0,
      matchedSnippet: undefined,
      score: undefined,
    }));
  }

  // Exact cwd match
  const stmt = db.prepare(
    `SELECT id, path, cwd, name, created_at, modified_at, message_count
     FROM sessions
     WHERE cwd = ?
     ORDER BY modified_at DESC
     LIMIT ?`,
  );
  const rows = stmt.all(targetResolved, limit) as Array<{
    id: string;
    path: string;
    cwd: string | null;
    name: string | null;
    created_at: string | null;
    modified_at: string | null;
    message_count: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    cwd: row.cwd || "",
    name: row.name ?? undefined,
    created: row.created_at ?? row.modified_at ?? "",
    modified: row.modified_at ?? row.created_at ?? "",
    messageCount: row.message_count ?? 0,
    matchedSnippet: undefined,
    score: undefined,
  }));
}

/**
 * Resolve a session UUID to a SessionRef using the DB directly.
 * Returns null if the session is not found.
 */
export function resolveSessionRef(sessionId: string): SessionRef | null {
  try {
    const db = getDb();
    const stmt = db.prepare(
      "SELECT id, cwd, name, created_at, modified_at FROM sessions WHERE id = ?",
    );
    const row = stmt.get(sessionId) as
      | {
          id: string;
          cwd: string | null;
          name: string | null;
          created_at: string | null;
          modified_at: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name || "(untitled)",
      cwd: row.cwd || "",
      created: row.created_at || "",
      modified: row.modified_at || "",
    };
  } catch (_error) {
    void _error;
    return null;
  }
}

/**
 * Search sessions by name using SQL LIKE. Fast alternative to FTS for
 * short tokens (avoids expensive FTS matches for single characters).
 */
export function searchSessionsByName(
  token: string,
  cwd?: string,
): SessionResult[] {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT id, path, cwd, name, created_at, modified_at, message_count
     FROM sessions
     WHERE (? IS NULL OR cwd LIKE ?) AND name LIKE ?
     ORDER BY modified_at DESC`,
  );
  const cwdFilter = cwd ? `${cwd}%` : null;
  const rows = stmt.all(cwdFilter, cwdFilter, `%${token}%`) as Array<{
    id: string;
    path: string;
    cwd: string | null;
    name: string | null;
    created_at: string | null;
    modified_at: string | null;
    message_count: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    cwd: row.cwd || "",
    name: row.name ?? undefined,
    created: row.created_at ?? row.modified_at ?? "",
    modified: row.modified_at ?? row.created_at ?? "",
    messageCount: row.message_count ?? 0,
    matchedSnippet: row.name || "(recent session)",
    score: 0,
  }));
}
