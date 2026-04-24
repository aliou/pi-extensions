/**
 * `@@` session autocomplete provider.
 *
 * On `@@<token>` in the input editor, searches the Sesame index for sessions
 * matching the token (or lists recent sessions for bare `@@`). On accept, the
 * completion inserts `@@<uuid>`. The `@@<uuid>` marker stays in the user
 * message and is resolved to hidden context in `before_agent_start`.
 */

import { join } from "node:path";
import type { SearchResult as SesameSearchResult } from "@aliou/sesame";
import { getXDGPaths, openDatabase, search } from "@aliou/sesame";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@mariozechner/pi-tui";

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Match `@@` plus an optional token at end of text before cursor. */
const AT_TOKEN_RE = /@@([^\s@]*)$/;

/** Match `@@<uuid>` markers anywhere in text. */
const AT_UUID_RE =
  /@@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

/** Debounce window for autocomplete searches (ms). */
const DEBOUNCE_MS = 150;

/** Minimum token length to use FTS. Shorter tokens use name LIKE instead. */
const FTS_MIN_TOKEN_LEN = 3;

/**
 * Relative time string from an ISO date.
 */
function timeAgo(isoDate: string): string {
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
function tildePath(p: string): string {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return `~${p.slice(home.length)}`;
  return p;
}

/**
 * Extract the `@@<token>` at the end of `textBeforeCursor`.
 * Returns the token (empty string for bare `@@`) or undefined if no match.
 */
function extractSessionToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(AT_TOKEN_RE);
  return match ? (match[1] ?? "") : undefined;
}

/**
 * Open the Sesame DB. Returns undefined if the DB can't be opened.
 */
function openSesameDb() {
  try {
    const paths = getXDGPaths();
    const dbPath = join(paths.data, "index.sqlite");
    return openDatabase(dbPath);
  } catch {
    return undefined;
  }
}

/**
 * Resolve a session UUID to metadata via the DB directly.
 * Returns null if the session is not found.
 */
function resolveSessionRefFromDb(
  db: NonNullable<ReturnType<typeof openDatabase>>,
  sessionId: string,
): {
  id: string;
  name: string;
  cwd: string;
  created: string;
  modified: string;
} | null {
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
  } catch {
    return null;
  }
}

/**
 * Search sessions by name using SQL LIKE. Fast alternative to FTS for
 * short tokens (avoids 40K+ FTS matches for single characters).
 */
function searchByName(
  db: NonNullable<ReturnType<typeof openDatabase>>,
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

// ---------------------------------------------------------------------------
// Resolved session references (module-scoped)
// ---------------------------------------------------------------------------

interface ResolvedRef {
  id: string;
  name: string;
  cwd: string;
  created: string;
  modified: string;
}

/** Pending `@@<uuid>` refs resolved during `input`, consumed in `before_agent_start`. */
let pendingRefs: ResolvedRef[] = [];

// ---------------------------------------------------------------------------
// Autocomplete provider factory
// ---------------------------------------------------------------------------

function createSessionAutocompleteProvider(
  current: AutocompleteProvider,
  cwd: string,
  currentSessionId: string,
): AutocompleteProvider {
  // Debounce: incrementing generation counter. Only the latest call
  // survives the debounce window.
  let generation = 0;

  return {
    async getSuggestions(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
      options,
    ): Promise<AutocompleteSuggestions | null> {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      const token = extractSessionToken(textBeforeCursor);

      if (token === undefined) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      // Debounce: wait, then check if we're still the latest call
      const thisGen = ++generation;
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));

      if (thisGen !== generation) {
        return null; // superseded by a newer keystroke
      }

      if (options.signal.aborted) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const db = openSesameDb();
      if (!db) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      try {
        const query = token === "" ? "*" : token;

        // Use session-name LIKE for short tokens (FTS is ~10s for single chars)
        const useFts = token === "" || token.length >= FTS_MIN_TOKEN_LEN;
        const results = useFts
          ? search(db, query, { cwd, limit: 20 })
          : searchByName(db, token, cwd, 20);

        if (options.signal.aborted) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        // Filter out current session from results
        const filtered = results.filter(
          (r: SesameSearchResult) => r.sessionId !== currentSessionId,
        );

        if (filtered.length === 0) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const items: AutocompleteItem[] = filtered.map(
          (r: SesameSearchResult) => {
            const name = r.name || "(untitled session)";
            const modified = r.modifiedAt || "";

            return {
              value: `@@${r.sessionId}`,
              label: name,
              description: modified ? timeAgo(modified) : undefined,
            };
          },
        );

        return {
          items,
          prefix: `@@${token}`,
        };
      } catch {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      } finally {
        db.close();
      }
    },

    applyCompletion(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
      item: AutocompleteItem,
      prefix: string,
    ) {
      return current.applyCompletion(
        lines,
        cursorLine,
        cursorCol,
        item,
        prefix,
      );
    },

    shouldTriggerFileCompletion(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
    ) {
      // Don't trigger file completion when typing `@@` tokens
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      if (extractSessionToken(textBeforeCursor) !== undefined) {
        return false;
      }
      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default async function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const currentSessionId = ctx.sessionManager.getSessionId();
    const cwd = ctx.cwd;

    // Register the stacked autocomplete provider
    ctx.ui.addAutocompleteProvider((current) =>
      createSessionAutocompleteProvider(current, cwd, currentSessionId),
    );
  });

  // On `input`, resolve `@@<uuid>` markers via DB
  pi.on("input", async (event) => {
    const text = event.text;
    const db = openSesameDb();
    if (!db) {
      pendingRefs = [];
      return { action: "continue" } as const;
    }

    try {
      const refs: ResolvedRef[] = [];
      const seen = new Set<string>();

      const re = new RegExp(AT_UUID_RE.source, "g");
      let match: RegExpExecArray | null = re.exec(text);
      while (match !== null) {
        const sessionId = match[1];
        if (sessionId && !seen.has(sessionId)) {
          seen.add(sessionId);
          const ref = resolveSessionRefFromDb(db, sessionId);
          if (ref) {
            refs.push(ref);
          }
        }
        match = re.exec(text);
      }

      pendingRefs = refs;
    } finally {
      db.close();
    }

    // Text is NOT modified — `@@<uuid>` stays as-is in the user message
    return { action: "continue" } as const;
  });

  // On `before_agent_start`, inject hidden context for resolved refs
  pi.on("before_agent_start", async () => {
    if (pendingRefs.length === 0) return;

    const lines = pendingRefs.map((ref) => {
      const name = ref.name || "(untitled)";
      const cwdDisplay = tildePath(ref.cwd);
      return `- session ${ref.id}: name="${name}", cwd=${cwdDisplay}, created=${ref.created}, modified=${ref.modified}\n  Use read_session({ sessionId: "${ref.id}", goal: "..." }) to access its content.`;
    });

    const content = `The user referenced the following sessions:\n${lines.join("\n")}`;

    pendingRefs = [];

    return {
      message: {
        customType: "breadcrumbs:session-ref",
        content,
        display: false,
      },
    } as const;
  });
}
