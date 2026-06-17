import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentDetails } from "@harness/agent-kit/runtime";
import { QqParams } from "./types";

export async function runQqSubagent(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  systemPrompt: string,
  userMessage: string,
): Promise<SubagentDetails | undefined> {
  if (!ctx.model) return undefined;

  const qqSubagent = createSubagent(pi, {
    name: "qq",
    label: "QQ",
    description: "Answer a quick side question",
    systemPrompt,
    tools: [],
    modelPreferences: [
      {
        provider: ctx.model.provider,
        model: ctx.model.id,
        thinking: "off",
      },
    ],
    session: { inheritSessionId: false },
    parameters: QqParams,
    buildPrompt: (params) => ({ text: params.prompt }),
  });

  const result = await qqSubagent.runWithParams(
    { prompt: userMessage },
    { callId: "qq", ctx },
  );

  return result.details;
}
