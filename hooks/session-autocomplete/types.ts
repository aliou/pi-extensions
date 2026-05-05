export interface ResolvedRef {
  id: string;
  name: string;
  cwd: string;
  created: string;
  modified: string;
}

/** Prefix for session autocomplete references. */
export const SESSION_AUTOCOMPLETE_PREFIX = "@@";

/** Match `@@` plus an optional token at end of text before cursor. */
export const AT_TOKEN_RE = /@@([^\s@]*)$/;

/** Match `@@<uuid>` markers anywhere in text. */
export const AT_UUID_RE =
  /@@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

/** Debounce window for autocomplete searches (ms). */
export const DEBOUNCE_MS = 150;

/** Minimum token length to use FTS. Shorter tokens use name LIKE instead. */
export const FTS_MIN_TOKEN_LEN = 3;
