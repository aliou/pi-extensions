import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendLocalAgents, loadLocalAgentsFile } from "./load";

/**
 * Append `.agents/AGENTS.local.md` (from `cwd` only) to the system prompt.
 *
 * Pi's built-in resource loader only reads `AGENTS.md` / `CLAUDE.md` walking
 * from `cwd` up to the filesystem root. It does not consult `.agents/` for
 * instruction files. This hook fills that gap for a single cwd-local file:
 * `.agents/AGENTS.local.md`.
 *
 * `before_agent_start` is emitted with the freshly rebuilt base system prompt
 * each agent loop, so appending here does not accumulate across turns.
 */
export default function resourceLoader(pi: ExtensionAPI): void {
  pi.on("before_agent_start", (event) => {
    const cwd = event.systemPromptOptions.cwd;
    if (!cwd) return;

    const file = loadLocalAgentsFile(cwd);
    if (!file) return;

    const next = appendLocalAgents(event.systemPrompt, file);
    if (next === event.systemPrompt) return;

    return { systemPrompt: next };
  });
}
