/**
 * Command-path docs generation: audit check -> plan dialog -> apply.
 *
 * Used by /docs:update and /docs:setup. The check returns a DocsCheckResult
 * directly (via the submit_check tool), so there is nothing to parse. The
 * apply subagent is a fresh invocation that takes the plan as input.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PlanDialog } from "../components/plan-dialog";
import type { DocsSubagents } from "../subagents/docs-agent";
import { beginApply, endApply } from "./state";
import type { DocsCheckResult } from "./types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface GenerationOutcome {
  applied: boolean;
  summary?: string;
}

/**
 * Run an audit check, confirm via plan dialog, then apply.
 * Notifies the user at each step. Safe to call from a command handler.
 */
export async function runAuditGeneration(
  ctx: ExtensionContext,
  subagents: DocsSubagents,
  docsPath: string,
): Promise<GenerationOutcome> {
  const sessionId = ctx.sessionManager.getSessionId();

  ctx.ui.setStatus("autodocs", "checking docs…");
  let result: DocsCheckResult | undefined;
  try {
    result = await subagents.runCheck(
      { reason: "audit", sessionId, docsPath },
      ctx,
    );
  } catch (err) {
    ctx.ui.setStatus("autodocs", undefined);
    ctx.ui.notify(`autodocs check failed: ${errorMessage(err)}`, "error");
    return { applied: false };
  } finally {
    ctx.ui.setStatus("autodocs", undefined);
  }

  if (!result?.needsUpdate || result.targets.length === 0) {
    ctx.ui.notify("autodocs: docs are up to date.", "info");
    return { applied: false };
  }

  if (!ctx.hasUI) {
    ctx.ui.notify(
      "autodocs: docs drift detected. Run in TUI to apply.",
      "warning",
    );
    return { applied: false };
  }

  const decision = await ctx.ui.custom(
    (_tui, theme, _kb, done) =>
      new PlanDialog(theme, result.targets, result.brief, done),
    { overlay: true },
  );
  if (decision !== "apply") {
    ctx.ui.notify("autodocs: cancelled.", "info");
    return { applied: false };
  }

  if (!beginApply()) {
    ctx.ui.notify(
      "autodocs: another docs operation is in progress.",
      "warning",
    );
    return { applied: false };
  }

  ctx.ui.setStatus("autodocs", "applying docs…");
  try {
    const summary = await subagents.runApply(
      { sessionId, docsPath, plan: JSON.stringify(result.targets) },
      ctx,
    );
    ctx.ui.notify(`autodocs: ${summary || "docs updated."}`, "info");
    return { applied: true, summary };
  } catch (err) {
    ctx.ui.notify(`autodocs apply failed: ${errorMessage(err)}`, "error");
    return { applied: false };
  } finally {
    endApply();
    ctx.ui.setStatus("autodocs", undefined);
  }
}
