import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerSubagentsSettings } from "@subagents/commands/settings-command";
import {
  configLoader,
  isSubagentEnabled,
  SUBAGENT_NAMES,
  type SubagentName,
} from "@subagents/config";
import { createJesterTool } from "@subagents/jester";
import { clearSubagentModelSelections } from "@subagents/lib/subagent-model-selection";
import { createLookoutTool } from "@subagents/lookout";
import { createOracleTool } from "@subagents/oracle";
import { createReviewerTool } from "@subagents/reviewer";
import { createScoutTool } from "@subagents/scout";
import { createWorkerTool } from "@subagents/worker";

/**
 * Subagents Extension
 *
 * Provides specialized subagents with custom tools:
 * - scout: Web research and GitHub codebase exploration
 * - lookout: Local codebase search by functionality/concept (uses osgrep)
 * - oracle: Expert AI advisor for complex reasoning and planning
 * - reviewer: Code review feedback on diffs
 * - jester: Random data generator (no tools, high variance)
 * - worker: Focused implementation agent for well-defined tasks on specific files
 *
 */

/** Check required API keys, throw if missing */
function checkApiKeys(): string[] {
  const missing: string[] = [];

  if (!process.env.SCOUT_GITHUB_TOKEN) {
    missing.push("SCOUT_GITHUB_TOKEN");
  }

  return missing;
}

export default async function (pi: ExtensionAPI) {
  // Load config
  await configLoader.load();

  // Don't hard-fail extension load on missing API keys.
  // This keeps no-external-deps tools (e.g. jester) easy to test.
  const missing = checkApiKeys();
  if (missing.length > 0) {
    console.warn(
      `subagents: missing env vars (${missing.join(", ")}). Some tools may fail when invoked.`,
    );
  }

  // Reset per-session model selections so each session can re-pick randomly.
  pi.on("session_start", async () => {
    clearSubagentModelSelections();
  });

  // Register settings command
  registerSubagentsSettings(pi);

  // Always register all tools so they can be toggled on/off dynamically.
  pi.registerTool(createScoutTool());
  pi.registerTool(createLookoutTool());
  pi.registerTool(createOracleTool());
  pi.registerTool(createReviewerTool());
  pi.registerTool(createJesterTool());
  pi.registerTool(createWorkerTool());

  // Before each agent turn: sync active tools with current config.
  pi.on("before_agent_start", async () => {
    const disabledSubagents = new Set(
      SUBAGENT_NAMES.filter((name) => !isSubagentEnabled(name)),
    );

    const activeTools = pi.getActiveTools().filter((tool) => {
      const baseName = tool.startsWith("subagent.")
        ? tool.slice("subagent.".length)
        : tool;
      return !disabledSubagents.has(baseName as SubagentName);
    });
    pi.setActiveTools(activeTools);
  });
}
