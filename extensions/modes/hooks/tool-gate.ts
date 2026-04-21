import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { AD_NOTIFY_DANGEROUS_EVENT } from "../../../packages/events";

import { showModeConfirmDialog } from "../components/mode-confirm";
import {
  addSessionAllowedTool,
  getCurrentMode,
  getSessionAllowedTools,
} from "../state";

function getBashCommand(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const value = (input as { command?: unknown }).command;
  return typeof value === "string" ? value : "";
}

function emitDangerousEvent(
  pi: ExtensionAPI,
  description: string,
  command = "",
  toolName?: string,
  toolCallId?: string,
): void {
  pi.events.emit(AD_NOTIFY_DANGEROUS_EVENT, {
    source: "modes:tool-gate",
    command,
    description,
    pattern: "(mode-gate)",
    toolName,
    toolCallId,
  });
}

export function setupToolGateHook(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    const mode = getCurrentMode();

    // gatedTools and allowedTools are assumed disjoint.
    if (!mode.gatedTools.includes(event.toolName)) {
      return;
    }

    const sessionAllowed = getSessionAllowedTools();
    if (sessionAllowed.has(event.toolName)) {
      return;
    }

    const bashCommand =
      event.toolName === "bash" ? getBashCommand(event.input) : undefined;

    if (!ctx.hasUI) {
      return {
        block: true,
        reason: `${mode.name} mode: ${event.toolName} requires confirmation (no UI to confirm)`,
      };
    }

    emitDangerousEvent(
      pi,
      `Confirmation required by ${mode.name} mode: ${event.toolName}`,
      bashCommand ?? event.toolName,
      event.toolName,
      event.toolCallId,
    );

    const decision = await showModeConfirmDialog(
      ctx,
      mode.name,
      event.toolName,
      bashCommand,
      true,
    );

    if (decision === "allow") {
      return;
    }

    if (decision === "allow-session") {
      addSessionAllowedTool(event.toolName);
      return;
    }

    return { block: true, reason: "Blocked by user" };
  });
}
