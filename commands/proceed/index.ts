import type {
  ContextEvent,
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";

const PROCEED_CUSTOM_TYPE = "harness:proceed";

export const PROCEED_DESCRIPTION =
  "Resume the agentic loop without sending prompt text to the LLM";

interface TextBlock {
  type: "text";
  text: string;
}

interface SessionEntryLike {
  type: string;
  message?: {
    role?: string;
    content?: unknown;
  };
}

function isProceedMarker(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const candidate = message as { role?: unknown; customType?: unknown };
  return (
    candidate.role === "custom" && candidate.customType === PROCEED_CUSTOM_TYPE
  );
}

function extractText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;

  const textBlocks = content.filter((block: unknown): block is TextBlock => {
    if (!block || typeof block !== "object") return false;
    const candidate = block as { type?: unknown; text?: unknown };
    return candidate.type === "text" && typeof candidate.text === "string";
  });

  if (textBlocks.length === 0) return undefined;
  return textBlocks.map((block) => block.text).join("\n");
}

function getLastAssistantMessageText(
  entries: readonly SessionEntryLike[],
): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry) continue;
    if (
      entry.type === "message" &&
      entry.message?.role === "assistant" &&
      entry.message.content
    ) {
      return extractText(entry.message.content);
    }
  }
  return undefined;
}

export default function proceedCommand(pi: ExtensionAPI): void {
  pi.on("context", (event: ContextEvent) => {
    const messages = event.messages.filter(
      (message) => !isProceedMarker(message),
    );
    if (messages.length !== event.messages.length) {
      return { messages };
    }
    return undefined;
  });

  pi.registerCommand("proceed", {
    description: PROCEED_DESCRIPTION,
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const subcommand = args.trim().toLowerCase();

      if (subcommand === "status") {
        const last = getLastAssistantMessageText(
          ctx.sessionManager.getEntries() as SessionEntryLike[],
        );
        ctx.ui.notify(
          [
            "/proceed status:",
            `  Agent idle: ${ctx.isIdle() ? "yes" : "no"}`,
            `  Last assistant: ${last ? last.slice(0, 120) : "(none)"}`,
          ].join("\n"),
          "info",
        );
        return;
      }

      if (subcommand === "help") {
        ctx.ui.notify(
          [
            "/proceed           Resume loop without prompt text",
            "/proceed status    Show idle state and last assistant text",
            "/proceed help      Show this message",
          ].join("\n"),
          "info",
        );
        return;
      }

      pi.sendMessage(
        {
          customType: PROCEED_CUSTOM_TYPE,
          content: [],
          display: false,
          details: undefined,
        },
        {
          triggerTurn: true,
          deliverAs: "followUp",
        },
      );
    },
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "proceed",
      description: "resume without prompt text",
    });
  });
}
