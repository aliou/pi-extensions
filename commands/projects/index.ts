import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildAgentsPrompt } from "./commands/init/agents-prompt";
import {
  applySelections,
  getInstalled,
  readSettings,
} from "./commands/init/installer";
import { buildNixPrompt } from "./commands/init/nix";
import { showWizard } from "./commands/init/wizard";
import { configLoader } from "./config";

export default async function (pi: ExtensionAPI): Promise<void> {
  await configLoader.load();

  pi.registerCommand("projects:init", {
    description: "Initialize project with skills, packages, and AGENTS.md",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("projects:init requires interactive mode", "error");
        return;
      }

      const config = configLoader.getConfig();
      if (!config.registry || !config.scope) {
        ctx.ui.notify(
          "No npm registry configured. Edit the projects settings JSON file to set registry and scope.",
          "warning",
        );
        return;
      }

      const result = await showWizard(
        ctx,
        config.registry,
        config.scope,
        config.childProjectDepth,
      );

      if (!result) {
        ctx.ui.notify("Project init cancelled", "info");
        return;
      }

      // Apply selections
      if (
        result.selectedEntries.length > 0 ||
        result.unselectedEntries.length > 0
      ) {
        const settings = await readSettings(ctx.cwd);
        const installed = getInstalled(settings);

        await applySelections(
          ctx.cwd,
          result.selectedEntries,
          result.unselectedEntries,
        );

        const added = result.selectedEntries.length;
        const removed = result.unselectedEntries.filter((e) =>
          installed.has(e.npmRef),
        ).length;

        const parts: string[] = [];
        if (added > 0) parts.push(`${added} added`);
        if (removed > 0) parts.push(`${removed} removed`);
        if (parts.length > 0) {
          ctx.ui.notify(`Settings updated: ${parts.join(", ")}`, "info");
        }
      }

      // Build combined prompt for nix + AGENTS.md generation
      const promptParts: string[] = [];

      if (result.nixChoice !== "skip") {
        promptParts.push(
          buildNixPrompt(result.nixChoice, result.stack, {
            hasShell: result.nixHasShell,
            hasFlake: result.nixHasFlake,
          }),
        );
      }

      if (result.generateAgents && result.agentsDirs.length > 0) {
        promptParts.push(
          buildAgentsPrompt(
            result.stack,
            result.selectedEntries,
            result.agentsDirs,
            result.agentsPrompt,
          ),
        );
      }

      if (promptParts.length > 0) {
        pi.sendUserMessage(promptParts.join("\n\n---\n\n"));
      }
    },
  });
}
