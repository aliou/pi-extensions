/**
 * Sesame database access for session autocomplete.
 */

import { join } from "node:path";
import { getXDGPaths, openDatabase } from "@aliou/sesame";
import type { ResolvedRef } from "./types";

export type SesameDb = NonNullable<ReturnType<typeof openDatabase>>;

export function openSesameDb(): SesameDb | undefined {
  try {
    const paths = getXDGPaths();
    const dbPath = join(paths.data, "index.sqlite");
    return openDatabase(dbPath);
  } catch (_error) {
    void _error;
    return undefined;
  }
}

/**
 * Resolve a session UUID to metadata via the DB directly.
 * Returns null if the session is not found.
 */
export function resolveSessionRefFromDb(
  db: SesameDb,
  sessionId: string,
): ResolvedRef | null {
  try {
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
