import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { SubagentActivityItem } from "./types";

type MessageUpdateEvent = Extract<
  AgentSessionEvent,
  { type: "message_update" }
>;

export class SubagentMessageTracker {
  thinking = false;
  readonly activity: SubagentActivityItem[] = [];
  private currentThinking?: Extract<SubagentActivityItem, { type: "thinking" }>;

  update(event: MessageUpdateEvent) {
    const messageEvent = event.assistantMessageEvent;

    if (messageEvent.type === "thinking_start") {
      this.startThinking();
      return true;
    }

    if (messageEvent.type === "thinking_delta") {
      this.appendThinking(messageEvent.delta);
      return true;
    }

    if (messageEvent.type === "thinking_end") {
      this.stopThinking(messageEvent.content);
      return true;
    }

    return false;
  }

  private startThinking() {
    if (this.currentThinking) return;

    this.thinking = true;
    this.currentThinking = {
      type: "thinking",
      startedAt: Date.now(),
      endedAt: null,
      content: "",
    };
    this.activity.push(this.currentThinking);
  }

  private appendThinking(delta: string) {
    if (!this.currentThinking) {
      this.startThinking();
    }

    if (!this.currentThinking) return;
    this.currentThinking.content += delta;
  }

  stopThinking(content?: string) {
    this.thinking = false;
    if (!this.currentThinking) return;

    if (content !== undefined) {
      this.currentThinking.content = content;
    }
    this.currentThinking.endedAt = Date.now();
    this.currentThinking = undefined;
  }
}
