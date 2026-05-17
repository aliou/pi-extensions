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
import { listProjects } from "./projects";
import {
  MAX_PROJECT_SUGGESTIONS,
  PROJECT_PREFIX,
  PROJECT_TOKEN_RE,
  PROJECTS_ROOT,
} from "./types";

function extractProjectToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(PROJECT_TOKEN_RE);
  return match ? (match[1] ?? "") : undefined;
}

export function createProjectAutocompleteProvider(
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
      const token = extractProjectToken(textBeforeCursor);

      if (token === undefined) {
        const currentSuggestions = await current.getSuggestions(
          lines,
          cursorLine,
          cursorCol,
          options,
        );

        const prefixCandidate = extractPrefixCandidate(
          textBeforeCursor,
          PROJECT_PREFIX,
        );
        if (prefixCandidate !== undefined) {
          const prefixItem = createPrefixCompletionItem({
            value: PROJECT_PREFIX,
            description: "zoxide entries in ~/code/src",
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
        const projects = await listProjects(pi, options.signal).then((items) =>
          items
            .filter((p) => p.relPath.toLowerCase().includes(tokenLower))
            .slice(0, MAX_PROJECT_SUGGESTIONS),
        );

        if (options.signal.aborted) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        if (projects.length === 0) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const items: AutocompleteItem[] = projects.map((project) => {
          const score = project.score.toFixed(1).padStart(6, "0");
          return {
            value: project.relPath,
            label: project.label,
            description: `${score} · ${project.tildePath}`,
          };
        });

        return {
          items,
          prefix: `${PROJECT_PREFIX}${token}`,
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
      if (PROJECT_PREFIX.startsWith(prefix) && item.value === PROJECT_PREFIX) {
        return replaceAutocompletePrefix(
          lines,
          cursorLine,
          cursorCol,
          prefix,
          PROJECT_PREFIX,
        );
      }

      // Only apply custom insertion for zoxide items (prefix is @z:...)
      if (!prefix.startsWith(PROJECT_PREFIX)) {
        return current.applyCompletion(
          lines,
          cursorLine,
          cursorCol,
          item,
          prefix,
        );
      }

      // Insert ~/code/src/<relPath> instead of the bare relPath
      const tildePath = `${PROJECTS_ROOT}/${item.value}`;
      return replaceAutocompletePrefix(
        lines,
        cursorLine,
        cursorCol,
        prefix,
        `${tildePath} `,
      );
    },

    shouldTriggerFileCompletion(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
    ) {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      if (extractProjectToken(textBeforeCursor) !== undefined) {
        return false;
      }

      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      );
    },
  };
}
