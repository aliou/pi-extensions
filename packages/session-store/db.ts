/**
 * Sesame database lifecycle management.
 *
 * Lazily-opened long-lived SQLite connection via sesame's openDatabase.
 * Consumers call getDb() to obtain the singleton; the connection is closed
 * on pi shutdown via dispose().
 */

import { join } from "node:path";
import { getXDGPaths, openDatabase } from "@aliou/sesame";

// Database is not re-exported from @aliou/sesame; derive it from openDatabase.
type Database = NonNullable<ReturnType<typeof openDatabase>>;

let db: Database | null = null;

/** Get the singleton DB connection, opening it on first call. */
export function getDb(): Database {
  if (!db) {
    const paths = getXDGPaths();
    const dbPath = join(paths.data, "index.sqlite");
    db = openDatabase(dbPath);
  }
  return db;
}

/** Close the connection and null the reference. Called on pi shutdown. */
export function dispose(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Close and null the reference. Next getDb() call reopens.
 * For use when we need to force-refresh after external writes.
 */
export function resetConnection(): void {
  if (db) {
    db.close();
    db = null;
  }
}
