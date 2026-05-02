import type { AssistantMessage, UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { defineSubagent } from "../../packages/agent-kit";
import { isBlank } from "../../packages/agent-kit/utils/string";
import { MODEL_CANDIDATES } from "./models";
import {
  buildPrompt,
  SESSION_TITLE_SYSTEM_PROMPT,
  type SessionTitleTurn,
} from "./prompt";
import { createSessionTitleTools } from "./tools";

const MAX_TURNS = 5;

export default async function sessionTitle(pi: ExtensionAPI): Promise<void> {
  const subagent = defineSubagent(pi, {
    name: "session_title",
    label: "Session Title",
    description: "Generate a concise session title.",
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
    }),
    buildPrompt: (params) => ({ text: buildPrompt(params) }),
  });

  pi.on("turn_end", async (event, ctx) => {
    if (!isBlank(pi.getSessionName())) return;

    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "stop") return;

    const turns = getRecentTurns(ctx.sessionManager.getBranch());
    if (turns.length === 0) return;

    try {
      ctx.ui.notify("Generating session title...", "info");

      await subagent.execute(
        "session-title",
        { turns },
        ctx.signal,
        undefined,
        ctx,
      );

      const title = pi.getSessionName();
      if (!isBlank(title)) ctx.ui.notify(`Session title: ${title}`, "info");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      ctx.ui.notify(`Session title generation failed: ${message}`, "error");
    }
  });
}

function getRecentTurns(entries: SessionEntry[]): SessionTitleTurn[] {
  const turns: SessionTitleTurn[] = [];
  let currentUserMessage: string | null = null;

  for (const entry of entries) {
    if (entry.type !== "message") continue;

    const message = entry.message;
    if (message.role === "user") {
      currentUserMessage = getUserText(message);
      continue;
    }

    if (message.role !== "assistant") continue;
    if (!currentUserMessage) continue;
    if (message.stopReason !== "stop") continue;

    const assistantResponse = getAssistantText(message as AssistantMessage);
    if (isBlank(assistantResponse)) continue;

    turns.push({
      userMessage: currentUserMessage,
      assistantResponse,
    });
  }

  return turns.slice(-MAX_TURNS);
}

function getUserText(message: UserMessage): string {
  if (typeof message.content === "string") return message.content;

  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("");
}

function getAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("");
}
