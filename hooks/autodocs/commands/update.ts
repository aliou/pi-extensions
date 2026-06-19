/**
 * /docs:update — manually regenerate docs on demand.
 *
 * Runs the audit/apply flow (bypassing the git hook). Only registered when
 * autodocs is enabled for the current project.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { findProjectEntry } from "../lib/config";
import { runAuditGeneration } from "../lib/generation";
import type { DocsSubagents } from "../subagents/docs-agent";

export function updateCommandOptions(subagents: DocsSubagents) {
  return {
    description: "Update docs based on the current codebase",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const entry = findProjectEntry(ctx.cwd);
      if (!entry) {
        ctx.ui.notify(
          "autodocs: not enabled. Run /docs:setup first.",
          "warning",
        );
        return;
      }
      await runAuditGeneration(ctx, subagents, entry.docsPath);
    },
  };
}
