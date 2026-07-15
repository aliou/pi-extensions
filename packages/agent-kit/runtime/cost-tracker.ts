import type { AssistantMessage, Usage } from "@earendil-works/pi-ai";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

type MessageEndEvent = Extract<AgentSessionEvent, { type: "message_end" }>;

export function emptyUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

export class SubagentCostTracker {
  private usage = emptyUsage();
  private lastAssistantUsage = emptyUsage();

  get value() {
    return this.usage;
  }

  get responseTokens() {
    return this.lastAssistantUsage.output;
  }

  update(event: MessageEndEvent) {
    if (!isAssistantMessage(event.message)) return false;

    this.lastAssistantUsage = event.message.usage;
    this.usage = addUsage(this.usage, event.message.usage);
    return true;
  }
}

export function isAssistantMessage(
  message: unknown,
): message is AssistantMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "role" in message &&
    message.role === "assistant" &&
    "usage" in message
  );
}

function addUsage(current: Usage, next: Usage): Usage {
  return {
    input: current.input + next.input,
    output: current.output + next.output,
    cacheRead: current.cacheRead + next.cacheRead,
    cacheWrite: current.cacheWrite + next.cacheWrite,
    totalTokens: current.totalTokens + next.totalTokens,
    cost: {
      input: current.cost.input + next.cost.input,
      output: current.cost.output + next.cost.output,
      cacheRead: current.cost.cacheRead + next.cost.cacheRead,
      cacheWrite: current.cost.cacheWrite + next.cost.cacheWrite,
      total: current.cost.total + next.cost.total,
    },
  };
}
