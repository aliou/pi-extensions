import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import {
  buildSessionContext,
  convertToLlm,
  serializeConversation,
} from "@mariozechner/pi-coding-agent";
import { QQ_SYSTEM_REMINDER } from "./lib/system-prompt";

export function buildQqPrompt(
  ctx: ExtensionCommandContext,
  question: string,
): { userMessage: string; systemPrompt: string } {
  const entries = ctx.sessionManager.getBranch();
  const sessionContext = buildSessionContext(
    entries,
    ctx.sessionManager.getLeafId(),
  );
  const llmMessages = convertToLlm(sessionContext.messages);

  const filtered = llmMessages.filter((msg) => {
    if (
      msg.role === "assistant" &&
      (msg.stopReason === undefined || msg.stopReason === null)
    ) {
      return false;
    }
    return true;
  });

  const serialized = serializeConversation(filtered);

  return {
    userMessage: `${serialized}\n\n---\n\nSide question: ${question}`,
    systemPrompt: ctx.getSystemPrompt() + QQ_SYSTEM_REMINDER,
  };
}
