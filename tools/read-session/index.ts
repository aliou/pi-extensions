import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { SYSTEM_PROMPT } from "./prompt";
import { renderReadSessionHeader, tools } from "./tools";
import { ReadSessionParams } from "./types";

export default async function readSession(pi: ExtensionAPI): Promise<void> {
  const subagent = createSubagent(pi, {
    name: "read_session",
    label: "Read Session",
    description:
      "Zero-shot past-session extractor. Provide a session ID/path plus a specific extraction goal with names, dates, topics, and expected output.",
    promptSnippet:
      "Past-session extractor for pulling specific facts, decisions, summaries, or evidence from Pi session history.",
    promptGuidelines: [
      "read_session: Use to extract specific information from a past Pi coding session by session ID, UUID prefix, or session .jsonl file path.",
      "read_session: Do not use for the current session or general codebase search.",
      "read_session: GLM extraction works best with a narrow target and explicit output shape. Provide a specific, self-contained goal describing what information to extract and how to format it.",
      "read_session: Include known names, dates, projects, topics, files, decisions, or tool names in the goal so the subagent can search narrowly.",
      "read_session: Ask for cited session evidence when you need exact decisions, commands, or implementation details; ask it to say 'not found' for missing facts rather than infer.",
      "read_session: Avoid vague goals like 'summarize this'. Prefer requests like 'extract the final decision, files changed, commands run, and unresolved questions'.",
    ],
    systemPrompt: SYSTEM_PROMPT,
    tools,
    // Primary: synthetic GLM-4.7-Flash (cheapest measured read_session model,
    // 38/38). Fallback: neuralwatt glm-5.2-short-fast (reasoning disabled -> off
    // only). Flash exposes off/medium; "low" clamps to "medium". ~9% bleed at 0.1.
    modelPreferences: [
      {
        provider: "synthetic",
        model: "hf:zai-org/GLM-4.7-Flash",
        thinking: "low",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "glm-5.2-short-fast",
        thinking: "off",
        weight: 0.1,
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
