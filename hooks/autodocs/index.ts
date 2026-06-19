/**
 * autodocs — local docs sync for Pi.
 *
 * On-device AutoWiki: keeps a project's docs/ directory in sync with the
 * codebase. Three pieces:
 *
 *   1. Commands (live set depends on enabled state, decided at session_start):
 *        - /docs:setup  (when disabled) enable + generate/reorganize docs
 *        - /docs:update (when enabled)  regenerate docs on demand
 *        - /docs:off    (when enabled)  disable
 *
 *   2. A git hook: on tool_result for a bash git op that advanced the default
 *      branch, run a read-only drift check; if drift exists, show a minimal
 *      accent gate. Accept injects a nextTurn suggestion the main agent sees
 *      on its next turn. Headless auto-suggests.
 *
 *   3. A docs subagent (ad:utility:text, internal-only) with two modes:
 *      check (read-only, returns its result via the submit_check tool) and
 *      apply (write). Both carry the bundled autodocs skills.
 *
 * Config is global and machine-local: <agentDir>/extensions/autodocs.json,
 * keyed by project dir path. Enablement = presence of an entry (ancestors
 * inherit, so subdirectories are covered).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";
import { offCommandOptions } from "./commands/off";
import { setupCommandOptions } from "./commands/setup";
import { updateCommandOptions } from "./commands/update";
import { findProjectEntry } from "./lib/config";
import { runDriftCheck } from "./lib/drift-check";
import { couldAdvanceMain, snapshotMainSha } from "./lib/git-detect";
import { resolveMainBranch } from "./lib/main-branch";
import { reset } from "./lib/state";
import type { StashedSha } from "./lib/types";
import {
  AUTODOCS_SUGGESTION_TYPE,
  type AutodocsSuggestionDetails,
} from "./lib/types";
import { renderSuggestion } from "./renderers/suggestion-renderer";
import { createDocsSubagents } from "./subagents/docs-agent";

export default function autodocs(pi: ExtensionAPI): void {
  const subagents = createDocsSubagents(pi);
  const stash = new Map<string, StashedSha>();
  const mainBranchCache = new Map<string, string | undefined>();

  pi.registerMessageRenderer<AutodocsSuggestionDetails>(
    AUTODOCS_SUGGESTION_TYPE,
    renderSuggestion,
  );

  /** Register the command set appropriate for a cwd's enabled state. */
  function registerCommandsFor(cwd: string): void {
    if (findProjectEntry(cwd)) {
      pi.registerCommand("docs:update", updateCommandOptions(subagents));
      pi.registerCommand("docs:off", offCommandOptions());
    } else {
      pi.registerCommand("docs:setup", setupCommandOptions(subagents));
    }
  }

  // Initial registration (covers startup before session_start fires).
  registerCommandsFor(process.cwd());

  pi.on("session_start", (_event, ctx) => {
    registerCommandsFor(ctx.cwd);
  });

  pi.on("session_shutdown", () => {
    stash.clear();
    mainBranchCache.clear();
    reset();
  });

  // --- git hook: snapshot before, compare after ---

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const command = (event.input as { command?: string }).command;
    if (!command || !couldAdvanceMain(command)) return;
    if (!findProjectEntry(ctx.cwd)) return; // not enabled

    let mainBranch: string | undefined;
    if (mainBranchCache.has(ctx.cwd)) {
      mainBranch = mainBranchCache.get(ctx.cwd);
    } else {
      mainBranch = await resolveMainBranch(pi, ctx.cwd);
      mainBranchCache.set(ctx.cwd, mainBranch);
    }
    if (!mainBranch) return;
    const fromSha = await snapshotMainSha(pi, ctx.cwd, mainBranch);
    if (!fromSha) return;

    stash.set(event.toolCallId, { cwd: ctx.cwd, mainBranch, fromSha });
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const stashed = stash.get(event.toolCallId);
    stash.delete(event.toolCallId);
    if (!stashed || event.isError) return;

    const entry = findProjectEntry(ctx.cwd);
    if (!entry) return;

    // Fire-and-forget: the check + gate run in the background so the agent
    // loop is not blocked. Accepting the gate enqueues a nextTurn suggestion.
    void runDriftCheck(pi, ctx, subagents, entry.docsPath, stashed);
  });

  // Header entry: advertise the command that is actually live.
  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    const enabled = Boolean(findProjectEntry(process.cwd()));
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: enabled ? "docs:update" : "docs:setup",
      description: "local docs sync",
    });
  });
}
