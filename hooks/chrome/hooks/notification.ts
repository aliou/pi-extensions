/**
 * Notification Hook
 *
 * Sends OS-level notifications directly from defaults.
 * Uses terminal OSC sequences and optional macOS sounds.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ToolResultMessage } from "@earendil-works/pi-ai";
import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
  AD_NOTIFY_DONE_EVENT,
  type AdNotifyAttentionEvent,
  type AdNotifyDangerousEvent,
  type AdNotifyDoneEvent,
} from "@harness/events";

// Path to the native binary (resolved relative to this file)
const PLAY_ALERT_SOUND_BINARY = fileURLToPath(
  new URL("../../../bin/play-alert-sound", import.meta.url),
);

// const DEFAULT_SOUND = "/System/Library/Sounds/Blow.aiff";
const DEFAULT_SOUND = "/System/Library/Sounds/Funk.aiff";
const ATTENTION_SOUND = "/System/Library/Sounds/Glass.aiff";
const ERROR_SOUND = "/System/Library/Sounds/Basso.aiff";

/**
 * Find the last assistant message's stopReason in an event's messages array.
 * Returns the raw string (e.g. "stop", "aborted", "error") or undefined.
 */
function lastAssistantStopReason(event: AgentEndEvent): string | undefined {
  const { messages } = event;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;

    return message.stopReason;
  }

  return undefined;
}

function isAgentRunAborted(event: AgentEndEvent): boolean {
  const stopReason = lastAssistantStopReason(event);
  return stopReason?.toLowerCase() === "aborted";
}

/**
 * An agent-level error means the last assistant message ended with
 * stopReason "error" (provider/LLM failure). This is distinct from a
 * tool-result error tracked via hadError, which only marks individual
 * tool calls that failed but still let the turn complete normally.
 */
function isAgentRunErrored(event: AgentEndEvent): boolean {
  return lastAssistantStopReason(event)?.toLowerCase() === "error";
}

type ToolCallHandler = (
  event: ToolCallEvent,
  ctx: ExtensionContext,
) => string | undefined;
type ToolResultHandler = (
  event: ToolResultMessage,
  ctx: ExtensionContext,
) => string | undefined;

interface ToolStartNotification {
  toolName: string;
  trigger: "start";
  sound?: string;
  handler: ToolCallHandler;
}

interface ToolEndNotification {
  toolName: string;
  trigger: "end";
  sound?: string;
  handler: ToolResultHandler;
}

type ToolNotification = ToolStartNotification | ToolEndNotification;

const TOOL_NOTIFICATIONS: ToolNotification[] = [
  {
    toolName: "ask_user",
    trigger: "start",
    sound: ATTENTION_SOUND,
    handler: () => "Waiting for user input",
  },
];

/**
 * Send terminal notification using OSC escape sequences.
 * OSC 9: Ghostty, ConEmu
 * OSC 777: iTerm2, WezTerm, Kitty
 */
function sendSystemNotification(message: string): void {
  const title = "Pi";
  process.stdout.write(`\x1b]9;${title}: ${message}\x1b\\`);
  process.stdout.write(`\x1b]777;notify;${title};${message}\x1b\\`);
}

/**
 * Play notification sound (macOS only).
 * Uses the play-alert-sound binary which respects system alert volume.
 */
async function playSound(pi: ExtensionAPI, soundPath: string): Promise<void> {
  if (process.platform !== "darwin") return;
  if (!existsSync(PLAY_ALERT_SOUND_BINARY)) return;

  try {
    await pi.exec(PLAY_ALERT_SOUND_BINARY, [soundPath]);
  } catch (_error) {
    void _error;
    // Sound playback failed — not worth alerting the user over.
  }
}

function shouldUseTerminalEffects(): boolean {
  return process.stdout.isTTY;
}

function notificationsDelegatedToHerdr(): boolean {
  return process.env.HERDR_ENV === "1";
}

async function notify(
  pi: ExtensionAPI,
  message: string,
  sound?: string,
): Promise<void> {
  if (!shouldUseTerminalEffects()) return;
  sendSystemNotification(message);
  if (sound) await playSound(pi, sound);
}

async function handleDangerousLikeEvent(
  pi: ExtensionAPI,
  event: AdNotifyDangerousEvent,
): Promise<void> {
  const message = `Dangerous command detected: ${event.description}`;
  await notify(pi, message, ATTENTION_SOUND);
}

async function handleAttentionEvent(
  pi: ExtensionAPI,
  event: AdNotifyAttentionEvent,
): Promise<void> {
  const message = event.description ?? event.reason ?? "Waiting for user input";
  await notify(pi, message, ATTENTION_SOUND);
}

async function handleDoneEvent(
  pi: ExtensionAPI,
  event: AdNotifyDoneEvent,
): Promise<void> {
  const message = event.summary ?? "done";
  const sound = event.status === "error" ? ERROR_SOUND : DEFAULT_SOUND;
  await notify(pi, message, sound);
}

export function setupNotificationHook(pi: ExtensionAPI) {
  let loopCount = 0;
  let toolCallCount = 0;
  let agentMessageErrored = false;

  const startNotifications = TOOL_NOTIFICATIONS.filter(
    (n): n is ToolStartNotification => n.trigger === "start",
  );
  const endNotifications = TOOL_NOTIFICATIONS.filter(
    (n): n is ToolEndNotification => n.trigger === "end",
  );

  pi.on("session_start", async (event, ctx) => {
    if (
      event.reason === "startup" &&
      process.platform === "darwin" &&
      !existsSync(PLAY_ALERT_SOUND_BINARY)
    ) {
      ctx.ui.notify(
        `play-alert-sound binary not found at ${PLAY_ALERT_SOUND_BINARY}. Run scripts/build-native-tools.sh`,
        "warning",
      );
    }
  });

  pi.on("message_end", async (event) => {
    if (event.message.role !== "assistant") return;

    if (event.message.stopReason === "error") {
      agentMessageErrored = true;
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    toolCallCount++;

    const notification = startNotifications.find(
      (n) => n.toolName === event.toolName,
    );
    if (notification) {
      const message = notification.handler(event, ctx);
      if (message) {
        pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
          description: message,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
        });
      }
    }

    return undefined;
  });

  pi.on("turn_end", async (event, ctx) => {
    loopCount++;

    for (const result of event.toolResults) {
      const notification = endNotifications.find(
        (n) => n.toolName === result.toolName,
      );
      if (notification) {
        const message = notification.handler(result, ctx);
        if (message) {
          pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
            description: message,
            toolCallId: result.toolCallId,
            toolName: result.toolName,
          });
        }
      }
    }
  });

  pi.on("agent_end", async (event) => {
    const wasRunning = loopCount > 0;
    const wasAborted = isAgentRunAborted(event);

    if (wasRunning && !wasAborted) {
      // Provider/LLM-level failure (stopReason="error") is an agent-level
      // error, distinct from an individual tool call returning isError.
      const errored = agentMessageErrored || isAgentRunErrored(event);
      const status = errored ? "error" : "ok";
      const summary = `${errored ? "with errors" : "done"} - ${loopCount} loops, ${toolCallCount} tools`;
      pi.events.emit(AD_NOTIFY_DONE_EVENT, {
        source: "chrome:notification",
        status,
        loops: loopCount,
        toolCalls: toolCallCount,
        summary,
      });
    }

    // Reset counters for next run
    loopCount = 0;
    toolCallCount = 0;
    agentMessageErrored = false;
  });

  pi.events.on(AD_NOTIFY_DANGEROUS_EVENT, (data: unknown) => {
    if (notificationsDelegatedToHerdr()) return;
    void handleDangerousLikeEvent(pi, data as AdNotifyDangerousEvent);
  });

  pi.events.on(AD_NOTIFY_ATTENTION_EVENT, (data: unknown) => {
    if (notificationsDelegatedToHerdr()) return;
    void handleAttentionEvent(pi, data as AdNotifyAttentionEvent);
  });

  pi.events.on(AD_NOTIFY_DONE_EVENT, (data: unknown) => {
    if (notificationsDelegatedToHerdr()) return;
    void handleDoneEvent(pi, data as AdNotifyDoneEvent);
  });
}
