/**
 * `?` skill directory autocomplete provider.
 *
 * On `?<token>` or `??` in the input editor (at a token boundary),
 * suggests skill directories from configurable root paths. `??` forces
 * the full list without a filter. Accepting a completion leaves a compact
 * inline reference. On submission, every known reference is expanded to a
 * skill XML block while the skill name remains in the user's prose.
 *
 * The root paths are configured in `~/.pi/agent/settings/completion.json`:
 * ```json
 * { "skillsRoots": ["~/skills"] }
 * ```
 *
 * If the config file doesn't exist or any configured path doesn't exist,
 * a notification is shown on session start. The provider is still registered
 * with whatever valid roots exist.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMPLETION_EVENT,
  once,
} from "@harness/events";
import { resolveSkillsRoots } from "./config";
import { createSkillAutocompleteEditor } from "./editor";
import { expandSkillReferences } from "./expand";
import { createSkillAutocompleteProvider } from "./provider";
import { listSkills } from "./skills";

export default async function (pi: ExtensionAPI) {
  let skillsRoots: string[] = [];

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMPLETION_EVENT, {
      trigger: "?",
      description: "insert skill",
    });
  });

  pi.on("input", (event, ctx) => {
    if (skillsRoots.length === 0) return { action: "continue" };

    try {
      const result = expandSkillReferences(event.text, listSkills(skillsRoots));
      if (result.expandedSkills.length === 0) return { action: "continue" };
      return { action: "transform", text: result.text };
    } catch (error) {
      ctx.ui.notify(
        `Skill expansion failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      return { action: "continue" };
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const { valid, missing } = resolveSkillsRoots();
    skillsRoots = valid;

    if (valid.length === 0 && missing.length === 0) {
      ctx.ui.notify(
        "Skill autocomplete not configured. Set skillsRoots in ~/.pi/agent/settings/completion.json",
        "warning",
      );
      return;
    }

    if (missing.length > 0) {
      ctx.ui.notify(
        `Skill autocomplete: missing directories: ${missing.join(", ")}`,
        "warning",
      );
    }

    if (valid.length === 0) return;

    // Pi only invokes a single-character autocomplete trigger at a token
    // boundary. Preserve the default editor when another extension owns it.
    if (!ctx.ui.getEditorComponent()) {
      ctx.ui.setEditorComponent(createSkillAutocompleteEditor);
    }

    ctx.ui.addAutocompleteProvider((current) =>
      createSkillAutocompleteProvider(current, valid),
    );
  });
}
