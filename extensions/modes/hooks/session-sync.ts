import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  flushPendingModeState,
  restoreModeForSession,
} from "../lib/mode-lifecycle";

export function setupSessionSyncHooks(pi: ExtensionAPI): void {
  // Flush deferred mode-state at turn boundaries.
  pi.on("before_agent_start", () => {
    flushPendingModeState(pi);
  });

  pi.on("session_start", async (event, ctx) => {
    const reason = (event as { reason?: string }).reason;
    await restoreModeForSession(pi, ctx, reason === "startup", reason);
  });
}
