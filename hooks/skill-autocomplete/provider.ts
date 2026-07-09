/**
 * Skill autocomplete provider for `?<token>` completion.
 *
 * Uses `?` as a dedicated trigger character.
 *
 * - Bare `?` (no filter text): does not show suggestions, so Enter
 *   submits the editor naturally.
 * - `?<token>` (at least one filter character): shows filtered skills;
 *   pressing Enter replaces `?<token>` with the skill path.
 * - `? ` (space after `?`): bails out entirely.
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
      // is consumed. Delegate so other providers (e.g. file `@`) still work
      // instead of swallowing completion for the rest of the line.
      if (
        token === undefined &&
        SKILL_TRIGGER_CONSUMED_RE.test(textBeforeCursor)
      ) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      // Bare `?` with no filter text — don't show suggestions so
      // Enter submits the editor naturally.
      if (token === "") {
        return null;
      }

      if (token === undefined) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      try {
        const tokenLower = token.toLowerCase();
        const allSkills = listSkills(skillsRoots);
        const byName = allSkills.filter((s) =>
          s.name.toLowerCase().includes(tokenLower),
        );
        const byDesc = allSkills.filter(
          (s) =>
            !s.name.toLowerCase().includes(tokenLower) &&
            s.directory.toLowerCase().includes(tokenLower),
        );
        const skills = [...byName, ...byDesc];

        if (options.signal.aborted) {
          return null;
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
