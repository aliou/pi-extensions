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
import { listSkills } from "./skills";
import { SKILL_PREFIX, SKILL_TOKEN_RE } from "./types";

function extractSkillToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(SKILL_TOKEN_RE);
  return match ? (match[1] ?? "") : undefined;
}

export function createSkillAutocompleteProvider(
  current: AutocompleteProvider,
  skillsRoots: string[],
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
      const token = extractSkillToken(textBeforeCursor);

      if (token === undefined) {
        const currentSuggestions = await current.getSuggestions(
          lines,
          cursorLine,
          cursorCol,
          options,
        );

        const prefixCandidate = extractPrefixCandidate(
          textBeforeCursor,
          SKILL_PREFIX,
        );
        if (prefixCandidate !== undefined) {
          const prefixItem = createPrefixCompletionItem({
            value: SKILL_PREFIX,
            description: "skill directories",
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
        const skills = listSkills(skillsRoots).filter((s) =>
          s.name.toLowerCase().includes(tokenLower),
        );

        if (options.signal.aborted) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        if (skills.length === 0) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const items: AutocompleteItem[] = skills.map((skill) => ({
          value: skill.path,
          label: skill.name,
          description: skill.directory,
        }));

        return {
          items,
          prefix: `${SKILL_PREFIX}${token}`,
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
      if (SKILL_PREFIX.startsWith(prefix) && item.value === SKILL_PREFIX) {
        return replaceAutocompletePrefix(
          lines,
          cursorLine,
          cursorCol,
          prefix,
          SKILL_PREFIX,
        );
      }

      // Only apply custom insertion for skill items (prefix is @skill:...)
      if (!prefix.startsWith(SKILL_PREFIX)) {
        return current.applyCompletion(
          lines,
          cursorLine,
          cursorCol,
          item,
          prefix,
        );
      }

      // Insert the path to SKILL.md
      return replaceAutocompletePrefix(
        lines,
        cursorLine,
        cursorCol,
        prefix,
        `${item.value} `,
      );
    },

    shouldTriggerFileCompletion(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
    ) {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      if (extractSkillToken(textBeforeCursor) !== undefined) {
        return false;
      }

      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      );
    },
  };
}
