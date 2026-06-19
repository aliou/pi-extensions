/**
 * /docs:setup — enable autodocs for the current project and generate docs.
 *
 * Asks for a docs location (default "docs"), writes the project entry into
 * the global settings file, then runs the audit/apply flow to create or
 * reorganize existing docs (stale pages are archived, not deleted). Finally
 * swaps the live command set to /docs:update + /docs:off.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  enableProject,
  normalizeDocsPath,
  validateDocsPath,
} from "../lib/config";
import { runAuditGeneration } from "../lib/generation";
import type { DocsSubagents } from "../subagents/docs-agent";

export function setupCommandOptions(subagents: DocsSubagents) {
  return {
    description: "Enable autodocs for this project and generate docs",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/docs:setup requires interactive mode", "error");
        return;
      }

      const input = await ctx.ui.input(
        "Docs location (relative to project root)",
        "docs",
      );
      if (input === undefined) return;

      const err = validateDocsPath(input);
      if (err) {
        ctx.ui.notify(err, "warning");
        return;
      }

      const docsPath = normalizeDocsPath(input);
      enableProject(ctx.cwd, docsPath);
      ctx.ui.notify(`autodocs: enabled for ${docsPath}/`, "info");

      await runAuditGeneration(ctx, subagents, docsPath);

      // Reload so the command set swaps to /docs:update + /docs:off.
      // Do not use ctx after this point.
      await ctx.reload();
    },
  };
}
