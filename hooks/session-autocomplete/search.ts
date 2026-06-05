/**
 * Session search and display helpers.
 */

import type { SearchResult as SesameSearchResult } from "@aliou/sesame";
import type { TextContent, UserMessage } from "@earendil-works/pi-ai";
import type { SesameDb } from "./db";
import { AT_UUID_RE, type ResolvedRef } from "./types";

/**
 * Collapse `$HOME` prefix to `~`.
 */
export function tildePath(p: string): string {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return `~${p.slice(home.length)}`;
  return p;
}

/** Extract the concatenated text of a message's content. */
export function messageText(content: UserMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/** Extract unique `@@<uuid>` session ids from text, in order of appearance. */
export function extractSessionIds(text: string): string[] {
  const re = new RegExp(AT_UUID_RE.source, "g");
  const ids: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    const id = match[1];
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    match = re.exec(text);
  }
  return ids;
}

/** Build the guidance note describing referenced sessions for the LLM. */
export function buildSessionRefsContent(refs: ResolvedRef[]): string {
  const lines = refs.map((ref) => {
    const name = ref.name || "(untitled)";
    const cwdDisplay = tildePath(ref.cwd);
    return `  <session id="${ref.id}" name="${name}" cwd="${cwdDisplay}" created="${ref.created}" modified="${ref.modified}">
    Use read_session({ sessionId: "${ref.id}", goal: "..." }) to access its content.
  </session>`;
  });

  return `The user referenced the following sessions:\n${lines.join("\n")}`;
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
