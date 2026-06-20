import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { SYSTEM_PROMPT } from "./prompt";
import { renderReadSessionHeader, tools } from "./tools";
import { ReadSessionParams } from "./types";

export default async function readSession(pi: ExtensionAPI): Promise<void> {
  const subagent = createSubagent(pi, {
    name: "read_session",
    label: "Read Session",
    description: "Extract specific information from a past Pi coding session.",
    promptGuidelines: [
      "read_session: Use to extract specific information from a past Pi coding session by session ID, UUID prefix, or session .jsonl file path.",
      "read_session: Do not use for the current session or general codebase search.",
      "read_session: Provide a specific goal describing what information you want to extract.",
    ],
    systemPrompt: SYSTEM_PROMPT,
    tools,
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.3-codex-spark",
        thinking: "off",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "qwen3.6-35b-fast",
        thinking: "off",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "syn:small:vision",
        thinking: "medium",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "syn:small:text",
        thinking: "medium",
        weight: 1,
      },
    ],
    parameters: ReadSessionParams,
    renderHeader: renderReadSessionHeader,
    buildPrompt({ targetSessionId: sessionId, goal }) {
      // Log
      return {
        text: [
          `<target_session_id>${sessionId}</target_session_id>`,
          `<goal>${goal}</goal>`,
        ].join("\n"),
      };
    },

    // Store a custom entry with the target session id.
    beforeExecute: async (params, session, _ctx) => {
      // Log
      session.sessionManager.appendCustomEntry("read-session-state", {
        targetSessionId: params.targetSessionId,
        goal: params.goal,
      });
    },
  });

  subagent.register();
}
