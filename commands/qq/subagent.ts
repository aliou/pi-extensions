import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentDetails } from "@harness/agent-kit/runtime";
import { QqParams } from "./types";

/** Build the qq subagent config (identical for new and resume runs). */
function buildQqSubagent(
  pi: ExtensionAPI,
  model: Model<Api>,
  systemPrompt: string,
) {
  return createSubagent(pi, {
    name: "qq",
    label: "QQ",
    description: "Answer a quick side question",
    systemPrompt,
    tools: [],
    modelPreferences: [
      {
        provider: model.provider,
        model: model.id,
        thinking: "off",
        weight: 1,
      },
    ],
    parameters: QqParams,
    buildPrompt: (params) => ({ text: params.prompt }),
  });
}

/**
 * Run a qq subagent. When `sessionId` is omitted, starts a NEW side chat;
 * when provided, resumes that existing qq thread. Returns the run details,
 * or undefined when no model is selected.
 */
export async function runQq(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  systemPrompt: string,
  userMessage: string,
  sessionId?: string,
): Promise<SubagentDetails | undefined> {
  if (!ctx.model) return undefined;

  const qqSubagent = buildQqSubagent(pi, ctx.model, systemPrompt);
  const params = { prompt: userMessage };
  const result =
    sessionId === undefined
      ? await qqSubagent.runWithParams(params, { callId: "qq", ctx })
      : await qqSubagent.resumeWithParams(sessionId, params, {
          callId: "qq",
          ctx,
        });

  return result.details;
}
