/** Prefix for session autocomplete references. */
export const SESSION_AUTOCOMPLETE_PREFIX = "@@";

/**
 * Match a session token at the end of `textBeforeCursor`.
 *
 * A token is only recognized when:
 *  - `@@` (or `@@@` for global search) sits at a token boundary (start of
 *    line or immediately after whitespace), and
 *  - the characters from after the prefix up to the cursor contain no
 *    whitespace, backtick, quote, or additional `@`. The token therefore ends
 *    at the first word break and never spans the rest of the line.
 *
 * This prevents `@@` markers that were already accepted (e.g. `@@<uuid>`)
 * and `@@` inside backticks from hijacking completion on the rest of the
 * line. Callers that need to fully ignore tokens inside an inline code span
 * should additionally check {@link isInsideCodeSpan}.
 */
export const SESSION_TOKEN_RE = /(^|\s)(@@@?)([^\s`"@]*)$/;

/** Match `@@<uuid>` markers anywhere in text. */
export const AT_UUID_RE =
  /@@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

/** Debounce window for autocomplete searches (ms). */
export const DEBOUNCE_MS = 150;

/** Minimum token length to use FTS. Shorter tokens use name LIKE instead. */
export const FTS_MIN_TOKEN_LEN = 3;
