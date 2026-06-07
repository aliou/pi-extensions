/**
 * Text extraction and formatting helpers for session references.
 *
 * Moved from:
 * - session-autocomplete/search.ts: messageText(), extractSessionIds(), buildSessionRefsContent()
 */

import type { TextContent, UserMessage } from "@earendil-works/pi-ai";
import { collapseHomePath } from "@harness/utils/path";
import type { SessionRef } from "./types";

/** Match `@@<uuid>` markers anywhere in text. */
const AT_UUID_RE =
  /@@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

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
export function buildSessionRefsContent(refs: SessionRef[]): string {
  const lines = refs.map((ref) => {
    const name = ref.name || "(untitled)";
    const cwdDisplay = collapseHomePath(ref.cwd);
    return `  <session id="${ref.id}" name="${name}" cwd="${cwdDisplay}" created="${ref.created}" modified="${ref.modified}">
    Use read_session({ sessionId: "${ref.id}", goal: "..." }) to access its content.
  </session>`;
  });

  return `The user referenced the following sessions:\n${lines.join("\n")}`;
}
