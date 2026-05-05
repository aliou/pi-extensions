import {
  createPrefixCompletionItem,
  extractPrefixCandidate,
  prependCompletionItem,
  replaceAutocompletePrefix,
} from "@harness/completion";
import { formatRelativeTime } from "@harness/utils/formatters";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@mariozechner/pi-tui";
import { listLocalBranches } from "./git";
import {
  GIT_BRANCH_PREFIX,
  GIT_BRANCH_TOKEN_RE,
  MAX_BRANCH_SUGGESTIONS,
} from "./types";

function extractGitBranchToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(GIT_BRANCH_TOKEN_RE);
  return match ? (match[1] ?? "") : undefined;
}

export function createGitBranchAutocompleteProvider(
  current: AutocompleteProvider,
  cwd: string,
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
      const token = extractGitBranchToken(textBeforeCursor);

      if (token === undefined) {
        const currentSuggestions = await current.getSuggestions(
          lines,
          cursorLine,
          cursorCol,
          options,
        );

        const prefixCandidate = extractPrefixCandidate(
          textBeforeCursor,
          GIT_BRANCH_PREFIX,
        );
        if (prefixCandidate !== undefined) {
          const prefixItem = createPrefixCompletionItem({
            value: GIT_BRANCH_PREFIX,
            description: "local git branches",
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
        const branches = (await listLocalBranches(cwd))
          .filter((branch) => branch.name.toLowerCase().includes(tokenLower))
          .slice(0, MAX_BRANCH_SUGGESTIONS);

        if (options.signal.aborted) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        if (branches.length === 0) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const items: AutocompleteItem[] = branches.map((branch) => {
          const commitAge = formatRelativeTime(branch.lastCommitDate);
          const commitInfo = [commitAge, branch.lastCommitSubject]
            .filter(Boolean)
            .join(" · ");

          return {
            value: branch.name,
            label: branch.name,
            description: commitInfo,
          };
        });

        return {
          items,
          prefix: `${GIT_BRANCH_PREFIX}${token}`,
        };
      } catch {
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
      if (
        GIT_BRANCH_PREFIX.startsWith(prefix) &&
        item.value === GIT_BRANCH_PREFIX
      ) {
        return replaceAutocompletePrefix(
          lines,
          cursorLine,
          cursorCol,
          prefix,
          GIT_BRANCH_PREFIX,
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
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      if (extractGitBranchToken(textBeforeCursor) !== undefined) {
        return false;
      }

      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      );
    },
  };
}
