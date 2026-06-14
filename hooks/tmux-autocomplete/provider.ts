/**
 * Tmux autocomplete provider for `@tmux:` completion.
 *
 * - `@tmux:<token>` — suggests tmux sessions filtered by token.
 * - Bare `@tmux:` — shows all sessions.
 *
 * Accepting a completion inserts `tmux:<session> ` (without the `@`).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import {
  createPrefixCompletionItem,
  extractPrefixCandidate,
  prependCompletionItem,
  replaceAutocompletePrefix,
} from "@harness/completion";
import { listSessions } from "./tmux";
import { MAX_SUGGESTIONS, TMUX_PREFIX, TMUX_TOKEN_RE } from "./types";

function extractToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(TMUX_TOKEN_RE);
  return match ? (match[1] ?? "") : undefined;
}

export function createTmuxAutocompleteProvider(
  current: AutocompleteProvider,
  pi: ExtensionAPI,
): AutocompleteProvider {
  return {
    async getSuggestions(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
      options,
    ): Promise<AutocompleteSuggestions | null> {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      const token = extractToken(textBeforeCursor);

      // No `@tmux:` prefix — maybe a partial prefix like `@t`
      if (token === undefined) {
        const currentSuggestions = await current.getSuggestions(
          lines,
          cursorLine,
          cursorCol,
          options,
        );

        const prefixCandidate = extractPrefixCandidate(
          textBeforeCursor,
          TMUX_PREFIX,
        );
        if (prefixCandidate !== undefined) {
          const prefixItem = createPrefixCompletionItem({
            value: TMUX_PREFIX,
            description: "tmux sessions",
          });

          return {
            items: prependCompletionItem(currentSuggestions?.items, prefixItem),
            prefix: prefixCandidate,
          };
        }

        return currentSuggestions;
      }

      try {
        const tokenLower = token.toLowerCase();
        const sessions = await listSessions(pi, options.signal);

        if (options.signal.aborted) return null;

        const filtered = sessions
          .filter((s) => s.name.toLowerCase().includes(tokenLower))
          .slice(0, MAX_SUGGESTIONS);

        if (filtered.length === 0) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const items: AutocompleteItem[] = filtered.map((s) => ({
          value: s.name,
          label: s.name,
          description: `${s.windows} window${s.windows !== 1 ? "s" : ""}${s.attached ? " (attached)" : ""}`,
        }));

        return {
          items,
          prefix: `${TMUX_PREFIX}${token}`,
        };
      } catch (_error) {
        void _error;
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }
    },

    applyCompletion(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
      item: AutocompleteItem,
      prefix: string,
    ) {
      // Prefix completion: partial @tmux → full @tmux:
      if (TMUX_PREFIX.startsWith(prefix) && item.value === TMUX_PREFIX) {
        return replaceAutocompletePrefix(
          lines,
          cursorLine,
          cursorCol,
          prefix,
          TMUX_PREFIX,
        );
      }

      if (!prefix.startsWith(TMUX_PREFIX)) {
        return current.applyCompletion(
          lines,
          cursorLine,
          cursorCol,
          item,
          prefix,
        );
      }

      // Session completion: insert tmux:<session> (no @ prefix)
      return replaceAutocompletePrefix(
        lines,
        cursorLine,
        cursorCol,
        prefix,
        `tmux:${item.value} `,
      );
    },

    shouldTriggerFileCompletion(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
    ) {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      if (extractToken(textBeforeCursor) !== undefined) {
        return false;
      }

      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      );
    },
  };
}
