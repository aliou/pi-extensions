/**
 * Prevent direct agent access to the sessions directory.
 *
 * Gates read, write, edit, and bash commands that target session files.
 * Agents should use find_sessions and read_session tools instead.
 *
 * Unified gating: both file tools and bash go through the same approval
 * mechanism — `allowAll` flag and `approvedSubtrees` path set.
 * write/edit are hard-blocked unconditionally.
 */

import { dirname } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  BLOCK_MESSAGE,
  emitSessionGateEvent,
  extractSessionTargets,
} from "./gate";
import {
  approveSubtree,
  getAllowAll,
  isApprovedPath,
  setAllowAll,
} from "./path-utils";
import { SessionGateDialog } from "./session-gate-dialog";
import type { SessionGateResult } from "./types";

export { _resetForTesting } from "./path-utils";

export default async function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const input = event.input as Record<string, unknown>;
    const request = extractSessionTargets(event.toolName, input);

    // 1. write/edit — hard-block unconditionally when targeting session dir
    //    Checked first so ambiguous write/edit paths are never silently allowed.
    if (event.toolName === "write" || event.toolName === "edit") {
      if (request.targets.length > 0 || request.ambiguous) {
        emitSessionGateEvent(
          pi,
          `Blocked: direct session file ${event.toolName}`,
          request.displayTarget,
          event.toolName,
          event.toolCallId,
        );
        return { block: true, reason: BLOCK_MESSAGE };
      }
      return; // Non-session write/edit — not gated.
    }

    // 2. No targets, not ambiguous — nothing to gate for read/bash
    if (request.targets.length === 0 && !request.ambiguous) return;

    // 3. Already approved
    if (getAllowAll()) return;
    if (
      request.targets.length > 0 &&
      request.targets.every((t) => isApprovedPath(t))
    )
      return;

    // 4. No UI — block
    if (!ctx.hasUI) {
      emitSessionGateEvent(
        pi,
        "Blocked: session access requires confirmation, but no UI is available",
        request.displayTarget,
        event.toolName,
        event.toolCallId,
      );
      return {
        block: true,
        reason:
          "Direct access to session files requires explicit user confirmation, but no UI is available.",
      };
    }

    // 5. Show dialog
    const description =
      event.toolName === "bash"
        ? request.ambiguous
          ? "may reference session files"
          : "access session files via bash"
        : "read a session file directly";

    emitSessionGateEvent(
      pi,
      `Confirmation required: ${description}`,
      request.displayTarget,
      event.toolName,
      event.toolCallId,
    );

    const decision = await ctx.ui.custom<SessionGateResult>(
      (_tui, theme, _kb, done) =>
        new SessionGateDialog(
          theme,
          description,
          request.displayTarget,
          request.ambiguous,
          done,
        ),
    );

    const result: SessionGateResult = decision ?? "deny";

    if (result === "deny") {
      return { block: true, reason: "User denied session file access" };
    }
    if (result === "allow-path") {
      // Store parent directory of each target so sibling files are covered.
      for (const t of request.targets) approveSubtree(dirname(t));
    }
    if (result === "allow-all") setAllowAll();

    return; // allow
  });
}
