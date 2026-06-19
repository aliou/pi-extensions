/**
 * Hook-path drift check: snapshot the new SHA, describe the advancement range,
 * run the read-only check subagent, then show the gate (or auto-suggest
 * headless).
 *
 * State guards against overlapping checks; reset() guarantees idle on exit.
 * Accepting the gate injects a nextTurn suggestion the main agent sees on its
 * next turn. Headless auto-suggests.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { GateDialog } from "../components/gate-dialog";
import type { DocsSubagents } from "../subagents/docs-agent";
import { describeAdvancement, snapshotMainSha } from "./git-detect";
import { beginCheck, closeGate, openGate, reset } from "./state";
import type {
  AutodocsSuggestionDetails,
  DocsCheckResult,
  GitAdvancement,
  StashedSha,
} from "./types";
import { AUTODOCS_SUGGESTION_TYPE } from "./types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Background drift check for a stashed git op. Fire-and-forget from the
 * tool_result hook so the agent loop is not blocked.
 */
export async function runDriftCheck(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  subagents: DocsSubagents,
  docsPath: string,
  stashed: StashedSha,
): Promise<void> {
  let advancement: GitAdvancement | undefined;
  try {
    const toSha = await snapshotMainSha(pi, stashed.cwd, stashed.mainBranch);
    if (!toSha) return;
    advancement = await describeAdvancement(
      pi,
      stashed.cwd,
      stashed.fromSha,
      toSha,
    );
    if (!advancement) return;
  } catch (err) {
    ctx.ui.notify(`autodocs: ${errorMessage(err)}`, "error");
    return;
  }

  if (!beginCheck(advancement)) return; // a check/gate is already in flight
  try {
    await checkAndGate(pi, ctx, subagents, docsPath, advancement);
  } finally {
    // closeGate() returns to idle after a gate round; reset() covers early
    // exits (no drift / error) so the machine never gets stuck.
    reset();
  }
}

async function checkAndGate(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  subagents: DocsSubagents,
  docsPath: string,
  advancement: GitAdvancement,
): Promise<void> {
  const sessionId = ctx.sessionManager.getSessionId();

  ctx.ui.setStatus("autodocs", "checking docs…");
  let result: DocsCheckResult | undefined;
  try {
    result = await subagents.runCheck(
      {
        reason: "drift",
        sessionId,
        docsPath,
        fromSha: advancement.fromSha,
        toSha: advancement.toSha,
      },
      ctx,
    );
  } catch (err) {
    ctx.ui.setStatus("autodocs", undefined);
    ctx.ui.notify(`autodocs check failed: ${errorMessage(err)}`, "error");
    return;
  }
  ctx.ui.setStatus("autodocs", undefined);

  if (!result?.needsUpdate || !result.brief) return;

  openGate();
  let accept = false;
  if (ctx.hasUI) {
    const decision = await ctx.ui.custom(
      (_tui, theme, _kb, done) =>
        new GateDialog(theme, advancement, result.brief, done),
      { overlay: true },
    );
    accept = decision === "accept";
  } else {
    // Headless: auto-suggest.
    accept = true;
  }

  if (accept) {
    pi.sendMessage<AutodocsSuggestionDetails>(
      {
        customType: AUTODOCS_SUGGESTION_TYPE,
        content: result.brief,
        display: true,
        details: {
          fromSha: advancement.fromSha,
          toSha: advancement.toSha,
          brief: result.brief,
          targets: result.targets,
        },
      },
      { deliverAs: "nextTurn", triggerTurn: false },
    );
    ctx.ui.notify(
      "autodocs: docs drift detected — suggested in next turn.",
      "info",
    );
  } else {
    ctx.ui.notify("autodocs: skipped.", "info");
  }
  closeGate();
}
