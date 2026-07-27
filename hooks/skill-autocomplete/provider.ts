/**
 * Skill autocomplete provider for `?<token>` completion.
 *
 * Uses `?` as a dedicated trigger character.
 *
 * - Bare `?` (no filter text): does not show suggestions, so Enter
 *   submits the editor naturally.
 * - `?<token>` (at least one filter character): shows filtered skills;
 *   pressing Enter replaces `?<token>` with a stable inline skill reference.
 * - `??`: shows every skill without requiring filter text.
 * - `? ` (space after `?`): bails out entirely.
 */

import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { replaceAutocompletePrefix } from "@harness/completion";
import { listSkills, type SkillsRoot } from "./skills";
import { SKILL_TOKEN_RE, SKILL_TRIGGER_CONSUMED_RE } from "./types";

interface SkillToken {
  trigger: string;
  token: string;
}

export function extractSkillToken(
  textBeforeCursor: string,
): SkillToken | undefined {
  const match = textBeforeCursor.match(SKILL_TOKEN_RE);
  if (!match) return undefined;

  return { trigger: match[1] ?? "?", token: match[2] ?? "" };
}

/** Prefix a skill's description with its `[source]` tag, mirroring pi's autocomplete. */
function prefixDescription(
  description: string | undefined,
  sourceLabel: string,
): string {
  const text = description?.trim() ? description : sourceLabel;
  return `[${sourceLabel}] ${text}`;
}

export function createSkillAutocompleteProvider(
  current: AutocompleteProvider,
  skillsRoots: SkillsRoot[],
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
      const skillToken = extractSkillToken(textBeforeCursor);

      // `?` was at a token boundary but followed by a space — the trigger
      // is consumed. Delegate so other providers (e.g. file `@`) still work
      // instead of swallowing completion for the rest of the line.
      if (
        skillToken === undefined &&
        SKILL_TRIGGER_CONSUMED_RE.test(textBeforeCursor)
      ) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      // Bare `?` with no filter text — don't show suggestions so
      // Enter submits the editor naturally.
      if (skillToken?.trigger === "?" && skillToken.token === "") {
        return null;
      }

      if (skillToken === undefined) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      try {
        const tokenLower = skillToken.token.toLowerCase();
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
          value: skill.name,
          label: skill.name,
          description: prefixDescription(
            skill.description ?? skill.directory,
            skill.sourceLabel,
          ),
        }));

        return {
          items,
          prefix: `${skillToken.trigger}${skillToken.token}`,
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
          `?${item.value} `,
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
