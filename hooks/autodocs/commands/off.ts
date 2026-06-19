/**
 * /docs:off — disable autodocs for the current project.
 *
 * Removes the project entry from the settings file (ancestor entries are
 * untouched). Existing docs are kept on disk. Swaps the live command set back
 * to /docs:setup.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { disableProject } from "../lib/config";

export function offCommandOptions() {
  return {
    description: "Disable autodocs for this project",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/docs:off requires interactive mode", "error");
        return;
      }

      const ok = await ctx.ui.confirm(
        "Disable autodocs for this project?",
        "Removes the project from autodocs settings. Existing docs are kept.",
      );
      if (!ok) return;

      disableProject(ctx.cwd);
      ctx.ui.notify("autodocs: disabled.", "info");

      // Reload so the command set swaps back to /docs:setup.
      // Do not use ctx after this point.
      await ctx.reload();
    },
  };
}
