/**
 * Session autocomplete provider for `@@<token>` completion.
 */

import type { SearchResult as SesameSearchResult } from "@aliou/sesame";
import { search } from "@aliou/sesame";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { replaceAutocompletePrefix } from "@harness/completion";
import { formatRelativeTime } from "@harness/utils/formatters";
import { collapseHomePath } from "@harness/utils/path";
import { openSesameDb } from "./db";
import { searchByName } from "./search";
import {
  AT_TOKEN_RE,
  DEBOUNCE_MS,
  FTS_MIN_TOKEN_LEN,
  SESSION_AUTOCOMPLETE_PREFIX,
} from "./types";

interface SessionToken {
  token: string;
  global: boolean;
  prefix: string;
}

/**
 * Extract the `@@<token>` or `@@@<token>` at the end of `textBeforeCursor`.
 * `@@@` searches all indexed sessions instead of filtering to the current cwd.
 */
function extractSessionToken(
  textBeforeCursor: string,
): SessionToken | undefined {
  const globalMatch = textBeforeCursor.match(/@@@([^@]*)$/);
  if (globalMatch) {
    return {
      token: globalMatch[1] ?? "",
      global: true,
      prefix: "@@@",
    };
  }

  const match = textBeforeCursor.match(AT_TOKEN_RE);
  return match
    ? {
        token: match[1] ?? "",
        global: false,
        prefix: SESSION_AUTOCOMPLETE_PREFIX,
      }
    : undefined;
}

export function createSessionAutocompleteProvider(
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
      const sessionToken = extractSessionToken(textBeforeCursor);

      if (sessionToken === undefined) {
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
        const { token, global } = sessionToken;
        const query = token === "" ? "*" : token;
        const searchCwd = global ? undefined : cwd;

        // Use session-name LIKE for recent sessions and short tokens
        // (FTS is ~10s for single chars).
        const useFts = token.length >= FTS_MIN_TOKEN_LEN;
        const results = useFts
          ? search(db, query, searchCwd ? { cwd: searchCwd } : undefined)
          : searchByName(db, token, searchCwd);

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
            const shortId = r.sessionId.slice(0, 8);
            const modified = r.modifiedAt || "";
            const relativeTime = modified ? formatRelativeTime(modified) : "";
            const score = r.score ? ` · ${r.score.toFixed(2)}` : "";
            const cwdDisplay =
              global && r.cwd ? ` · ${collapseHomePath(r.cwd)}` : "";

            return {
              value: `${SESSION_AUTOCOMPLETE_PREFIX}${r.sessionId}`,
              label: relativeTime
                ? `${shortId} · ${relativeTime}${score}`
                : `${shortId}${score}`,
              description: `${name}${cwdDisplay}`,
            };
          },
        );

        return {
          items,
          prefix: `${sessionToken.prefix}${token}`,
        };
      } catch (_error) {
        void _error;
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
      if (prefix.startsWith(SESSION_AUTOCOMPLETE_PREFIX)) {
        return replaceAutocompletePrefix(
          lines,
          cursorLine,
          cursorCol,
          prefix,
          item.value,
        );
      }

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
