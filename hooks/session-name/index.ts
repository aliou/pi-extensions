import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { isBlank } from "@harness/utils/string";
import { Type } from "typebox";
import { SESSION_NAME_REFINE_EVERY } from "./constants";
import { buildPrompt, SESSION_NAME_SYSTEM_PROMPT } from "./prompt";
import { createSessionNameTools } from "./tools";
import { countCompletedAssistantTurns, getRecentTurns } from "./turns";

export default async function sessionName(pi: ExtensionAPI): Promise<void> {
  const subagent = createSubagent(pi, {
    name: "session_name",
    label: "Session Name",
    description: "Generate or refine a concise session name.",
    systemPrompt: SESSION_NAME_SYSTEM_PROMPT,
    tools: createSessionNameTools(pi),
    maxToolCalls: 1,
    // Primary: synthetic GLM-4.7-Flash (cheapest; 147/149 in the window).
    // Fallback: neuralwatt glm-5.2-short-fast (reasoning disabled -> off only).
    // Both are low-cost non-reasoning tiers. ~9% bleed at weight 0.1.
    // NOTE: GLM-4.7-Flash has been observed inventing tools (open, cd, execute)
    // when not constrained; the session_name prompt must enumerate the single
    // allowed tool explicitly.
    modelPreferences: [
      {
        provider: "synthetic",
        model: "hf:zai-org/GLM-4.7-Flash",
        thinking: "off",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "glm-5.2-short-fast",
        thinking: "off",
        weight: 0.1,
      },
    ],
    parameters: Type.Object({
      turns: Type.Array(
        Type.Object({
          userMessage: Type.String(),
          assistantResponse: Type.String(),
        }),
      ),
      currentName: Type.Optional(Type.String()),
    }),
    buildPrompt: (params) => ({ text: buildPrompt(params) }),
  });

  pi.on("turn_end", async (event, ctx) => {
    if (event.message.role !== "assistant") return;
    if (event.message.stopReason !== "stop") return;

    const entries = ctx.sessionManager.getBranch();
    const turnCount = countCompletedAssistantTurns(entries);

    const isInitial = turnCount === 1;
    const isRefine =
      turnCount > 1 && turnCount % SESSION_NAME_REFINE_EVERY === 0;
    if (!isInitial && !isRefine) return;

    const turns = getRecentTurns(entries);
    if (turns.length === 0) return;

    const currentName = pi.getSessionName();

    ctx.ui.notify(
      isInitial ? "Generating session name..." : "Refining session name...",
      "info",
    );

    subagent
      .runWithParams(
        { turns, currentName },
        { callId: "session-name", signal: ctx.signal, ctx },
      )
      .then(() => {
        const name = pi.getSessionName();
        if (!isBlank(name)) {
          if (isBlank(currentName) || name === currentName) {
            ctx.ui.notify(`Session name: ${name}`, "info");
          } else {
            ctx.ui.notify(
              `Session name: from "${currentName}" to "${name}"`,
              "info",
            );
          }
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        ctx.ui.notify(`Session name generation failed: ${message}`, "error");
      });
  });
}
