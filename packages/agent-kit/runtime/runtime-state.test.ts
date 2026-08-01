import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import type { ResolvedSubagentConfig } from "../types";
import { SubagentRuntimeState } from "./runtime-state";

const Params = Type.Object({ task: Type.String() });

describe("SubagentRuntimeState", () => {
  it("records the session model and thinking level", () => {
    const config: ResolvedSubagentConfig<typeof Params> = {
      name: "eval-agent",
      label: "Eval Agent",
      description: "Evaluate an agent",
      systemPrompt: "Evaluate the task",
      tools: [],
      modelPreferences: [],
      configured: true,
      parameters: Params,
      buildPrompt: () => ({ text: "Evaluate" }),
    };
    const session = {
      sessionId: "session-id",
      sessionFile: "/tmp/session.jsonl",
      model: { provider: "openrouter", id: "z-ai/glm-5.2" },
      thinkingLevel: "high",
    } as AgentSession;

    const state = new SubagentRuntimeState(config, session);

    expect(state.snapshot().model).toEqual({
      provider: "openrouter",
      model: "z-ai/glm-5.2",
      thinking: "high",
    });
  });
});
