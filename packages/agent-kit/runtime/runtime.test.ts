import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  AgentSession,
  AgentSessionEvent,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedSubagentConfig } from "../types";
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

function successMessage(): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: "Finished" }],
    api: "openai-codex-responses",
    provider: "openai-codex",
    model: "gpt-5.5",
    usage: {
      input: 10,
      output: 5,
      cacheRead: 2,
      cacheWrite: 1,
      totalTokens: 18,
      cost: {
        input: 0.1,
        output: 0.2,
        cacheRead: 0.01,
        cacheWrite: 0.02,
        total: 0.33,
      },
    },
    stopReason: "stop",
    timestamp: 0,
  };
}

describe("SubagentRuntime", () => {
  it("returns nested model usage for parent session accounting", async () => {
    let listener: ((event: AgentSessionEvent) => void) | undefined;
    const message = successMessage();
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
        listener?.({ type: "message_end", message });
      }),
      getLastAssistantText: vi.fn(() => "Finished"),
      dispose: vi.fn(),
    } as unknown as AgentSession;
    const config: ResolvedSubagentConfig<typeof Params> = {
      name: "reviewer",
      label: "Reviewer",
      description: "Review code",
      systemPrompt: "Review code",
      tools: [],
      modelPreferences: [],
      configured: true,
      parameters: Params,
      buildPrompt: () => ({ text: "Review this diff" }),
    };

    const runtime = new SubagentRuntime(config, session, undefined);
    const result = await runtime.execute(
      "call-id",
      { task: "review" },
      undefined,
      {} as ExtensionContext,
    );

    expect(result.usage).toEqual(message.usage);
    expect(result.details.usage).toEqual(message.usage);
  });

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
    const config: ResolvedSubagentConfig<typeof Params> = {
      name: "reviewer",
      label: "Reviewer",
      description: "Review code",
      systemPrompt: "Review code",
      tools: [],
      modelPreferences: [],
      configured: true,
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
