/**
 * Session autocomplete provider for `@@<token>` completion.
 */

import type { SearchResult as SesameSearchResult } from "@aliou/sesame";
import { search } from "@aliou/sesame";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@mariozechner/pi-tui";
import { openSesameDb } from "./db";
import { searchByName, timeAgo } from "./search";
import { AT_TOKEN_RE, DEBOUNCE_MS, FTS_MIN_TOKEN_LEN } from "./types";

/**
 * Extract the `@@<token>` at the end of `textBeforeCursor`.
 * Returns the token (empty string for bare `@@`) or undefined if no match.
 */
function extractSessionToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(AT_TOKEN_RE);
  return match ? (match[1] ?? "") : undefined;
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
