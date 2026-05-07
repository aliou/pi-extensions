import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { defineSubagent } from "@harness/agent-kit";
import { QqParams } from "./types";

export async function runQqSubagent(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  systemPrompt: string,
  userMessage: string,
): Promise<string | undefined> {
  if (!ctx.model) return undefined;

  const qqSubagent = defineSubagent(pi, {
    name: "qq",
    label: "QQ",
    description: "Answer a quick side question",
    systemPrompt,
    tools: [],
    models: [
      {
        provider: ctx.model.provider,
        model: ctx.model.id,
        thinking: "off",
        weight: 1,
      },
    ],
    parameters: QqParams,
    buildPrompt: (params) => ({ text: params.prompt }),
  });

  const result = await qqSubagent.execute(
    "qq",
    { prompt: userMessage },
    undefined,
    undefined,
    ctx,
  );

  return result.details.response;
}
