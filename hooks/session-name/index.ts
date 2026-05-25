import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineSubagent } from "@harness/agent-kit";
import { isBlank } from "@harness/utils/string";
import { Type } from "typebox";
import { SESSION_NAME_REFINE_EVERY } from "./constants";
import { MODEL_CANDIDATES } from "./models";
import { buildPrompt, SESSION_NAME_SYSTEM_PROMPT } from "./prompt";
import { createSessionNameTools } from "./tools";
import { countCompletedAssistantTurns, getRecentTurns } from "./turns";

export default async function sessionName(pi: ExtensionAPI): Promise<void> {
  const subagent = defineSubagent(pi, {
    name: "session_name",
    label: "Session Name",
    description: "Generate or refine a concise session name.",
    systemPrompt: SESSION_NAME_SYSTEM_PROMPT,
    tools: createSessionNameTools(pi),
    models: MODEL_CANDIDATES,
    session: { inheritSessionId: false },
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
      .execute(
        "session-name",
        { turns, currentName },
        ctx.signal,
        undefined,
        ctx,
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
