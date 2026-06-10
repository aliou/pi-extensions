/**
 * Skill autocomplete provider for `?<token>` completion.
 *
 * Uses `?` as a dedicated trigger character. Typing `?` at a token
 * boundary (after space or at line start) with no filter text returns
 * nothing. Once the user types `?<token>`, skill suggestions appear.
 * If `?` is followed by a space, completion bails out entirely.
 */

import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { replaceAutocompletePrefix } from "@harness/completion";
import { listSkills } from "./skills";
import { SKILL_TOKEN_RE, SKILL_TRIGGER_CONSUMED_RE } from "./types";

function extractSkillToken(textBeforeCursor: string): string | undefined {
  const match = textBeforeCursor.match(SKILL_TOKEN_RE);
  return match ? (match[1] ?? "") : undefined;
}

export function createSkillAutocompleteProvider(
  current: AutocompleteProvider,
  skillsRoots: string[],
): AutocompleteProvider {
  return {
    triggerCharacters: ["?"],

    async getSuggestions(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
      options,
    ): Promise<AutocompleteSuggestions | null> {
      const currentLine = lines[cursorLine] ?? "";
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      const token = extractSkillToken(textBeforeCursor);

      // `?` was at a token boundary but followed by a space — the trigger
      // is consumed. Bail out instead of falling back to default completion.
      if (
        token === undefined &&
        SKILL_TRIGGER_CONSUMED_RE.test(textBeforeCursor)
      ) {
        return null;
      }

      if (token === undefined) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
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
          prefix: `?${token}`,
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
      if (prefix.startsWith("?")) {
        return replaceAutocompletePrefix(
          lines,
          cursorLine,
          cursorCol,
          prefix,
          `${item.value} `,
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
