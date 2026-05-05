/**
 * Session gate event emission and target extraction.
 */

import { isAbsolute, resolve } from "node:path";
import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { extractBashTargets } from "./bash-parser";
import { isInSessionsDir } from "./path-utils";
import type { SessionAccessRequest } from "./types";

export const BLOCK_MESSAGE =
  "Direct access to session files is restricted. " +
  "Prefer find_sessions + read_session. " +
  "Direct reads may be allowed via runtime toggle or explicit user confirmation.";

export function emitSessionGateEvent(
  pi: ExtensionAPI,
  description: string,
  command = "",
  toolName?: string,
  toolCallId?: string,
): void {
  const payload = {
    source: "breadcrumbs:protect-sessions-dir",
    command,
    description,
    toolName,
    toolCallId,
  };
  pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, payload);
}

/**
 * Extract session-dir targets from a tool call.
 */
export function extractSessionTargets(
  toolName: string,
  input: Record<string, unknown>,
): SessionAccessRequest {
  if (toolName === "bash") {
    return extractBashTargets(String(input.command ?? ""), isInSessionsDir);
  }

  // File tools: read, write, edit
  const rawPath = String(input.path ?? input.file_path ?? "");
  if (!rawPath) {
    return { targets: [], displayTarget: "", ambiguous: false };
  }

  if (isAbsolute(rawPath)) {
    const resolvedPath = resolve(rawPath);
    if (isInSessionsDir(resolvedPath)) {
      return {
        targets: [resolvedPath],
        displayTarget: resolvedPath,
        ambiguous: false,
      };
    }
    return { targets: [], displayTarget: "", ambiguous: false };
  }

  // Relative path containing sessions dir reference — suspicious, block.
  if (rawPath.includes("/.pi/agent/sessions")) {
    return { targets: [], displayTarget: rawPath, ambiguous: true };
  }

  // Relative path without sessions dir reference — not gated.
  return { targets: [], displayTarget: "", ambiguous: false };
}
