/**
 * `?` skill directory autocomplete provider.
 *
 * On `?<token>` in the input editor (at a token boundary), suggests
 * skill directories from configurable root paths. Accepting a
 * completion replaces the `?<token>` prefix with the absolute path
 * to SKILL.md.
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
import { resolveSkillsRoots } from "./config";
import { createSkillAutocompleteProvider } from "./provider";

export default async function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const { valid, missing } = resolveSkillsRoots();

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

    ctx.ui.addAutocompleteProvider((current) =>
      createSkillAutocompleteProvider(current, valid),
    );
  });
}
