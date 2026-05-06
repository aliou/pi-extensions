/**
 * Session search using the Sesame indexed search library.
 *
 * Session files live at ~/.pi/agent/sessions/--encoded-cwd--/timestamp_uuid.jsonl
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  getXDGPaths,
  openDatabase,
  type SearchOptions as SesameSearchOptions,
  type SearchResult as SesameSearchResult,
  search,
} from "@aliou/sesame";

export interface SessionSearchResult {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
  matchedSnippet?: string;
  score?: number;
}

export interface SearchOptions {
  query: string;
  cwd?: string;
  after?: string;
  before?: string;
  limit?: number;
}

/**
 * Parse relative date strings like "7d", "2w", "1m" or ISO dates.
 * Returns null if parsing fails.
 */
export function parseRelativeDate(input: string): Date | null {
  if (!input) return null;

  // Try ISO date format first
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Parse relative dates: "7d", "2w", "1m"
  const match = input.match(/^(\d+)([dwm])$/);
  if (!match) return null;

  const numStr = match[1];
  const unit = match[2];
  if (!numStr || !unit) return null;
  const num = parseInt(numStr, 10);
  const now = new Date();

  switch (unit) {
    case "d":
      now.setDate(now.getDate() - num);
      return now;
    case "w":
      now.setDate(now.getDate() - num * 7);
      return now;
    case "m":
      now.setMonth(now.getMonth() - num);
      return now;
    default:
      return null;
  }
}

/**
 * Get the sessions directory, respecting PI_CODING_AGENT_DIR env var.
 */
export function getSessionsDir(): string {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "sessions");
}

/**
 * Encode a cwd path to session directory format.
 * "/Users/foo/code" -> "--Users-foo-code--"
 */
export function encodeCwd(cwd: string): string {
  // Resolve to absolute path first to normalize ".." and "." segments.
  // Uses resolve() not realpathSync() because Pi stores sessions using the
  // logical path, not the symlink target.
  const resolved = resolve(cwd);
  // Strip leading slash, replace all slashes with hyphens
  const stripped = resolved.replace(/^[/\\]/, "");
  const encoded = stripped.replace(/[/\\]/g, "-");
  return `--${encoded}--`;
}

/**
 * Decode a session directory name back to a cwd path.
 * "--Users-foo-code--" -> "/Users/foo/code"
 */
export function decodeCwd(encoded: string): string {
  // Strip the leading and trailing "--"
  const stripped = encoded.replace(/^--/, "").replace(/--$/, "");
  // Replace hyphens with slashes and prepend leading slash
  return `/${stripped.replace(/-/g, "/")}`;
}

/**
 * Parse JSON JSONL line and extract text content from a message or compaction entry.
 */
function extractTextFromEntry(entry: unknown): string | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;

  const obj = entry as Record<string, unknown>;

  // For message entries: {"type":"message","message":{"role":"user","content":"text or array"}}
  if (obj.type === "message" && obj.message) {
    const msg = obj.message as Record<string, unknown>;
    if (msg.role === "user" && msg.content) {
      const content = msg.content;
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        // Extract text from content array (may contain {"type":"text","text":"..."})
        return content
          .filter(
            (c): c is Record<string, unknown> =>
              typeof c === "object" && c !== null,
          )
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .filter((t): t is string => typeof t === "string")
          .join(" ");
      }
    }
  }

  // For compaction entries: {"type":"compaction","summary":"..."}
  if (obj.type === "compaction" && obj.summary) {
    if (typeof obj.summary === "string") {
      return obj.summary;
    }
  }

  // For session_info entries: {"type":"session_info","name":"..."}
  if (obj.type === "session_info" && obj.name) {
    if (typeof obj.name === "string") {
      return obj.name;
    }
  }

  return undefined;
}

interface SessionFileMetadata {
  id: string;
  cwd: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
  sessionName?: string;
}

/**
 * Read metadata from a session file's header and first few hundred lines.
 */
export function readSessionFileMetadata(
  filePath: string,
): SessionFileMetadata | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const stats = statSync(filePath);

    if (lines.length === 0 || !lines[0]) return null;

    let header: {
      type?: string;
      id?: string;
      cwd?: string;
      timestamp?: string;
    };
    try {
      header = JSON.parse(lines[0]);
    } catch (_error) {
      void _error;
      return null;
    }

    if (header.type !== "session" || !header.id) return null;

    let messageCount = 0;
    let firstMessage = "";
    let sessionName: string | undefined;

    for (let i = 1; i < Math.min(500, lines.length); i++) {
      const line = lines[i];
      if (!line) continue;

      try {
        const entry = JSON.parse(line);

        if (entry.type === "message") {
          messageCount++;
          if (!firstMessage && entry.message?.role === "user") {
            firstMessage = extractTextFromEntry(entry) || "";
            if (firstMessage.length > 100) {
              firstMessage = `${firstMessage.slice(0, 100)}...`;
            }
          }
        }

        if (!sessionName && entry.type === "session_info" && entry.name) {
          sessionName = entry.name;
        }

        if (messageCount > 0 && firstMessage && sessionName) break;
      } catch (_error) {
        void _error;
        // Skip invalid lines
      }
    }

    return {
      id: header.id,
      cwd: header.cwd ?? "",
      created: header.timestamp ?? stats.mtime.toISOString(),
      modified: stats.mtime.toISOString(),
      messageCount,
      firstMessage: firstMessage || "(no messages yet)",
      sessionName,
    };
  } catch (_error) {
    void _error;
    return null;
  }
}

/**
 * Convert date filter to sesame library format (ISO date string).
 */
function toSesameDate(input?: string): string | undefined {
  if (!input) return undefined;

  // Preserve ISO-like input to match previous behavior
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input;
  }

  const parsed = parseRelativeDate(input);
  if (!parsed) return undefined;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Search sessions using the Sesame indexed search library.
 * Respects cwd and date filters, returns sorted results up to limit.
 */
export async function searchSessions(
  options: SearchOptions,
): Promise<SessionSearchResult[]> {
  const { query, cwd, after, before, limit = 10 } = options;

  if (!query || query.trim() === "") {
    return [];
  }

  const sesameOptions: SesameSearchOptions = {
    cwd,
    after: toSesameDate(after),
    before: toSesameDate(before),
    limit,
  };

  const paths = getXDGPaths();
  const dbPath = join(paths.data, "index.sqlite");
  const db = openDatabase(dbPath);

  try {
    const results = search(db, query, sesameOptions);

    return results.map((r: SesameSearchResult) => {
      const meta = readSessionFileMetadata(r.path);
      const created = r.createdAt ?? r.modifiedAt ?? meta?.modified;
      const modified = r.modifiedAt ?? meta?.modified ?? created;

      return {
        id: r.sessionId,
        path: r.path,
        cwd: r.cwd ?? "",
        name: r.name ?? meta?.sessionName,
        created: created || new Date(0).toISOString(),
        modified: modified || new Date(0).toISOString(),
        messageCount: meta?.messageCount ?? 0,
        firstMessage: meta?.firstMessage ?? "(no messages yet)",
        matchedSnippet: r.matchedSnippet || undefined,
        score: r.score,
      };
    });
  } finally {
    db.close();
  }
}

export interface SessionListResult {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
}

/**
 * List sessions for a given directory (or child directories up to depth).
 *
 * Reads session files from the encoded cwd directory under the Pi sessions root.
 * If depth > 0, also includes sessions from child directories whose decoded
 * path starts with the given cwd.
 */
export function listSessions(
  cwd: string,
  limit = 20,
  depth = 0,
): SessionListResult[] {
  const sessionsDir = getSessionsDir();
  const targetEncoded = encodeCwd(cwd);
  const targetResolved = resolve(cwd);

  // Collect matching session directories
  const matchingDirs: string[] = [];

  // Always include exact cwd match
  const exactDir = join(sessionsDir, targetEncoded);
  try {
    statSync(exactDir);
    matchingDirs.push(exactDir);
  } catch (_error) {
    void _error;
    // Directory doesn't exist
  }

  // If depth > 0, scan for child directories
  if (depth > 0) {
    try {
      const allDirs = readdirSync(sessionsDir);
      for (const dirName of allDirs) {
        if (dirName === targetEncoded) continue; // Already added
        if (!dirName.startsWith("--") || !dirName.endsWith("--")) continue;

        const decoded = decodeCwd(dirName);
        // Check if this decoded path is a child of the target cwd
        // and within the depth limit
        if (decoded.startsWith(`${targetResolved}/`)) {
          const relative = decoded.slice(targetResolved.length + 1);
          const relativeDepth = relative.split("/").length;
          if (relativeDepth <= depth) {
            const childDir = join(sessionsDir, dirName);
            try {
              if (statSync(childDir).isDirectory()) {
                matchingDirs.push(childDir);
              }
            } catch (_error) {
              void _error;
              // Skip unreadable
            }
          }
        }
      }
    } catch (_error) {
      void _error;
      // Can't read sessions dir
    }
  }

  // Collect sessions from matching directories
  const results: SessionListResult[] = [];

  for (const dir of matchingDirs) {
    try {
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .reverse(); // Most recent first (filenames start with timestamps)

      for (const file of files) {
        if (results.length >= limit * 2) break; // Over-collect then sort+trim

        const filePath = join(dir, file);
        const meta = readSessionFileMetadata(filePath);
        if (!meta) continue;

        results.push({
          id: meta.id,
          path: filePath,
          cwd: meta.cwd,
          name: meta.sessionName,
          created: meta.created,
          modified: meta.modified,
          messageCount: meta.messageCount,
          firstMessage: meta.firstMessage,
        });
      }
    } catch (_error) {
      void _error;
      // Skip unreadable directories
    }
  }

  // Sort by modified date descending, apply limit
  results.sort(
    (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime(),
  );
  return results.slice(0, limit);
}
