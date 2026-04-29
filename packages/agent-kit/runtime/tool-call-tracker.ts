import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { SubagentActivityItem, SubagentToolCall } from "./types";

type ToolExecutionStartEvent = Extract<
  AgentSessionEvent,
  { type: "tool_execution_start" }
>;

type ToolExecutionEndEvent = Extract<
  AgentSessionEvent,
  { type: "tool_execution_end" }
>;

export class SubagentToolCallTracker {
  readonly calls: SubagentToolCall[] = [];
  readonly activity: SubagentActivityItem[] = [];
  private callsById = new Map<string, SubagentToolCall>();

  start(event: ToolExecutionStartEvent) {
    if (this.callsById.has(event.toolCallId)) return;

    const call: SubagentToolCall = {
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: event.args,
      status: "running",
      startedAt: Date.now(),
      endedAt: null,
      error: null,
    };

    this.calls.push(call);
    this.callsById.set(call.toolCallId, call);
    this.activity.push({
      type: "tool_call",
      toolCallId: call.toolCallId,
      startedAt: call.startedAt,
    });
  }

  end(event: ToolExecutionEndEvent) {
    const call = this.callsById.get(event.toolCallId);
    if (!call) return;

    call.status = event.isError ? "error" : "success";
    call.endedAt = Date.now();
    call.error = event.isError ? String(event.result) : null;
  }
}
