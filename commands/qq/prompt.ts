import type { Message } from "@earendil-works/pi-ai";
import type {
  ExtensionCommandContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import {
  buildSessionContext,
  convertToLlm,
  serializeConversation,
} from "@earendil-works/pi-coding-agent";
import { isQqAnswerEntry } from "./context";
import { QQ_SYSTEM_REMINDER } from "./lib/system-prompt";

/** System prompt for the qq subagent: the parent session's system prompt plus
 * the qq reminder that scopes the subagent to a single side-question answer. */
export function buildQqSystemPrompt(ctx: ExtensionCommandContext): string {
  return ctx.getSystemPrompt() + QQ_SYSTEM_REMINDER;
}

/** User message for a NEW qq session: the full parent conversation (so the
 * subagent has the same context as the main agent) plus the side question. */
export function buildQqUserMessage(
  ctx: ExtensionCommandContext,
  question: string,
): string {
  const serialized = serializeParentBranch(ctx);
  return serialized
    ? `${serialized}\n\n---\n\nSide question: ${question}`
    : `Side question: ${question}`;
}

/** User message for a RESUMED qq session: only the parent messages that
 * arrived since the last answer in that qq thread (the delta), plus the new
 * question. The subagent already holds its own prior turns, so resending the
 * whole parent context would duplicate it. If nothing changed in the parent
 * since the last turn, only the bare question is sent. */
export function buildQqResumeMessage(
  ctx: ExtensionCommandContext,
  sessionId: string,
  question: string,
): string {
  const serialized = serializeParentDelta(ctx, sessionId);
  return serialized
    ? `${serialized}\n\n---\n\nSide question: ${question}`
    : `Side question: ${question}`;
}

function serializeParentBranch(ctx: ExtensionCommandContext): string {
  const entries = ctx.sessionManager.getBranch();
  const sessionContext = buildSessionContext(
    entries,
    ctx.sessionManager.getLeafId(),
  );
  const llmMessages = convertToLlm(sessionContext.messages);
  return serializeConversation(dropIncompleteAssistant(llmMessages));
}

/**
 * Serialize only the parent entries after the last qq answer belonging to
 * `sessionId`. That answer marks where the subagent last ran, so everything
 * after it is exactly the delta the subagent has not seen yet.
 */
function serializeParentDelta(
  ctx: ExtensionCommandContext,
  sessionId: string,
): string {
  const branch = ctx.sessionManager.getBranch();
  const anchorIdx = lastQqAnswerIndex(branch, sessionId);
  const delta = anchorIdx >= 0 ? branch.slice(anchorIdx + 1) : branch;
  if (delta.length === 0) return "";

  // `leafId` is intentionally omitted: buildSessionContext falls back to the
  // slice's last entry and walks up the contiguous delta via parentId, which
  // is exactly the messages the subagent has not seen yet. The real session
  // leaf may sit outside a non-contiguous slice, so passing it is unsafe.
  const sessionContext = buildSessionContext(delta, undefined);
  const llmMessages = convertToLlm(sessionContext.messages);
  return serializeConversation(dropIncompleteAssistant(llmMessages));
}

/** Index of the last qq answer entry for `sessionId`, or -1 if none. */
function lastQqAnswerIndex(branch: SessionEntry[], sessionId: string): number {
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (!entry || !isQqAnswerEntry(entry)) continue;
    const data = entry.data;
    if (data && (data.subagentSessionId || data.id) === sessionId) return i;
  }
  return -1;
}

/** Drop assistant turns that never finished (no stop reason). */
function dropIncompleteAssistant(messages: Message[]): Message[] {
  return messages.filter((msg) => {
    if (
      msg.role === "assistant" &&
      (msg.stopReason === undefined || msg.stopReason === null)
    ) {
      return false;
    }
    return true;
  });
}
