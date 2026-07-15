import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  AgentSession,
  AgentSessionEvent,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";
import type { SubagentConfig } from "../types";
import { SubagentRuntime } from "./runtime";

const Params = Type.Object({ task: Type.String() });

function overflowMessage(): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: "openai-codex-responses",
    provider: "openai-codex",
    model: "gpt-5.5",
    usage: {
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
    },
    stopReason: "error",
    errorMessage: "Your input exceeds the context window of this model.",
    timestamp: 0,
  };
}

describe("SubagentRuntime", () => {
  it("fails a blank context-overflow response", async () => {
    let listener: ((event: AgentSessionEvent) => void) | undefined;
    const session = {
      sessionId: "session-id",
      sessionFile: "/tmp/session.jsonl",
      model: {
        provider: "openai-codex",
        id: "gpt-5.5",
      },
      subscribe: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
      prompt: vi.fn(async () => {
        listener?.({ type: "message_end", message: overflowMessage() });
      }),
      getLastAssistantText: vi.fn(() => undefined),
      dispose: vi.fn(),
    } as unknown as AgentSession;
    const config: SubagentConfig<typeof Params> = {
      name: "reviewer",
      label: "Reviewer",
      description: "Review code",
      systemPrompt: "Review code",
      tools: [],
      modelPreferences: [],
      parameters: Params,
      buildPrompt: () => ({ text: "Review this diff" }),
    };

    const runtime = new SubagentRuntime(config, session, undefined);

    await expect(
      runtime.execute(
        "call-id",
        { task: "review" },
        undefined,
        {} as ExtensionContext,
      ),
    ).rejects.toThrow(
      "Start a new reviewer call with a narrower scope; do not call resume_reviewer",
    );
    expect(session.dispose).toHaveBeenCalledOnce();
  });
});
