/**
 * Pure helpers for detecting `@@` / `@@@` session-reference tokens in editor
 * input. Kept separate from {@link ./provider} so callers (and tests) can use
 * them without pulling in the session-store / Sesame native dependency.
 */

import { SESSION_AUTOCOMPLETE_PREFIX, SESSION_TOKEN_RE } from "./types";

export interface SessionToken {
  token: string;
  global: boolean;
  prefix: string;
}

/**
 * True when `position` in `text` falls inside an inline code span.
 *
 * Counts backticks before `position`; an odd count means we are between an
 * opening and a (still missing or balanced elsewhere) closing backtick. Used
 * to ignore `@@` tokens written inside backticks.
 */
export function isInsideCodeSpan(text: string, position: number): boolean {
  let count = 0;
  for (let i = 0; i < position; i += 1) {
    if (text[i] === "`") count += 1;
  }
  return count % 2 === 1;
}

/**
 * Extract the `@@<token>` or `@@@<token>` at the end of `textBeforeCursor`.
 *
 * `@@@` searches all indexed sessions instead of filtering to the current
 * cwd. Only matches at a token boundary (start of line or after whitespace)
 * and never spans whitespace, backticks, or quotes, so already-accepted
 * `@@<uuid>` markers and `@@` inside backticks do not hijack completion on
 * the rest of the line.
 */
export function extractSessionToken(
  textBeforeCursor: string,
): SessionToken | undefined {
  const match = textBeforeCursor.match(SESSION_TOKEN_RE);
  if (!match) return undefined;

  const leadingSep = match[1] ?? "";
  const prefix = match[2] ?? SESSION_AUTOCOMPLETE_PREFIX;
  const token = match[3] ?? "";

  // Ignore tokens that live inside an inline code span (e.g. `some @@ref`).
  if (
    isInsideCodeSpan(textBeforeCursor, (match.index ?? 0) + leadingSep.length)
  ) {
    return undefined;
  }

  return {
    token,
    global: prefix === "@@@",
    prefix,
  };
}
