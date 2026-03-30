import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { showModeConfirmDialog } from "@modes/components/mode-confirm";
import { resolveToolPolicy } from "@modes/modes";
import {
  addSessionAllowedTool,
  getCurrentMode,
  getSessionAllowedTools,
} from "@modes/state";
import { AD_NOTIFY_DANGEROUS_EVENT } from "@packages/events";

function getBashCommand(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const value = (input as { command?: unknown }).command;
  return typeof value === "string" ? value : "";
}

function formatBlockedReason(
  modeName: string,
  toolName: string,
  reason = "disabled",
): string {
  return `Blocked by ${modeName} mode: ${toolName} is ${reason}`;
}

function formatNoUiReason(modeName: string, toolName: string): string {
  return `Blocked by ${modeName} mode: ${toolName} requires confirmation (no UI to confirm)`;
}

function emitDangerousEvent(
  pi: ExtensionAPI,
  description: string,
  command = "",
  toolName?: string,
  toolCallId?: string,
): void {
  const payload = {
    source: "modes:tool-gate",
    command,
    description,
    pattern: "(mode-gate)",
    toolName,
    toolCallId,
  };

  pi.events.emit(AD_NOTIFY_DANGEROUS_EVENT, payload);
}

async function confirmToolCall(
  ctx: ExtensionContext,
  modeName: string,
  toolName: string,
  bashCommand: string | undefined,
  allowSession: boolean,
): Promise<"allow" | "allow-session" | "deny"> {
  if (!ctx.hasUI) return "deny";

  const reasonText =
    toolName === "bash" && !allowSession
      ? `Bash calls in ${modeName} mode require explicit approval for each call.`
      : `The tool ${toolName} requires confirmation in ${modeName} mode.`;

  return showModeConfirmDialog(
    ctx,
    modeName,
    toolName,
    bashCommand,
    allowSession,
    reasonText,
  );
}

export function setupToolGateHook(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    const mode = getCurrentMode();

    if (mode.name === "default") {
      return;
    }

    const rule = resolveToolPolicy(mode, event.toolName);

    if (rule.access === "disabled") {
      if (event.toolName === "bash") {
        emitDangerousEvent(
          pi,
          formatBlockedReason(mode.name, event.toolName),
          getBashCommand(event.input),
          event.toolName,
          event.toolCallId,
        );
      }

      return {
        block: true,
        reason: formatBlockedReason(mode.name, event.toolName),
      };
    }

    if (rule.access === "enabled") {
      return;
    }

    const allowSession = rule.allowSession ?? true;
    const sessionAllowed = getSessionAllowedTools();
    if (allowSession && sessionAllowed.has(event.toolName)) {
      return;
    }

    const bashCommand =
      event.toolName === "bash" ? getBashCommand(event.input) : undefined;

    if (!ctx.hasUI) {
      return {
        block: true,
        reason: formatNoUiReason(mode.name, event.toolName),
      };
    }

    emitDangerousEvent(
      pi,
      `Confirmation required by ${mode.name} mode: ${event.toolName}`,
      bashCommand ?? event.toolName,
      event.toolName,
      event.toolCallId,
    );

    const decision = await confirmToolCall(
      ctx,
      mode.name,
      event.toolName,
      bashCommand,
      allowSession,
    );

    if (decision === "allow") {
      return;
    }

    if (decision === "allow-session" && allowSession) {
      addSessionAllowedTool(event.toolName);
      return;
    }

    return { block: true, reason: "Blocked by user" };
  });
}
