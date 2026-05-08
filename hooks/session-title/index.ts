import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineSubagent } from "@harness/agent-kit";
import { isBlank } from "@harness/utils/string";
import { Type } from "typebox";
import { SESSION_TITLE_REFINE_EVERY } from "./constants";
import { MODEL_CANDIDATES } from "./models";
import { buildPrompt, SESSION_TITLE_SYSTEM_PROMPT } from "./prompt";
import { createSessionTitleTools } from "./tools";
import { countCompletedAssistantTurns, getRecentTurns } from "./turns";

export default async function sessionTitle(pi: ExtensionAPI): Promise<void> {
  const subagent = defineSubagent(pi, {
    name: "session_title",
    label: "Session Title",
    description: "Generate or refine a concise session title.",
    systemPrompt: SESSION_TITLE_SYSTEM_PROMPT,
    tools: createSessionTitleTools(pi),
    models: MODEL_CANDIDATES,
    parameters: Type.Object({
      turns: Type.Array(
        Type.Object({
          userMessage: Type.String(),
          assistantResponse: Type.String(),
        }),
      ),
      currentTitle: Type.Optional(Type.String()),
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
      turnCount > 1 && turnCount % SESSION_TITLE_REFINE_EVERY === 0;
    if (!isInitial && !isRefine) return;

    const turns = getRecentTurns(entries);
    if (turns.length === 0) return;

    const currentTitle = pi.getSessionName();

    ctx.ui.notify(
      isInitial ? "Generating session title..." : "Refining session title...",
      "info",
    );

    subagent
      .execute(
        "session-title",
        { turns, currentTitle },
        ctx.signal,
        undefined,
        ctx,
      )
      .then(() => {
        const title = pi.getSessionName();
        if (!isBlank(title)) {
          if (title !== currentTitle) {
            ctx.ui.notify(
              `Session title: from "${currentTitle}" to "${title}"`,
              "info",
            );
          } else {
            ctx.ui.notify(`Session title: ${title}`, "info");
          }
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        ctx.ui.notify(`Session title generation failed: ${message}`, "error");
      });
  });
}
