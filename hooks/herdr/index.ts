import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
  AD_NOTIFY_DONE_EVENT,
  type AdNotifyAttentionEvent,
  type AdNotifyDangerousEvent,
  type AdNotifyDoneEvent,
} from "@harness/events";

const HERDR_BLOCKED_EVENT = "herdr:blocked";

type BlockKind = "attention" | "dangerous" | "error";

interface ActiveBlock {
  kind: BlockKind;
  toolCallId?: string;
}

type DangerousNotification = AdNotifyDangerousEvent & {
  source?: string;
};

const activeBlocks = new Map<string, ActiveBlock>();

function block(
  pi: ExtensionAPI,
  key: string,
  activeBlock: ActiveBlock,
  label: string,
): void {
  if (activeBlocks.has(key)) return;

  activeBlocks.set(key, activeBlock);
  pi.events.emit(HERDR_BLOCKED_EVENT, { active: true, label });
}

function unblock(pi: ExtensionAPI, key: string): void {
  if (!activeBlocks.delete(key)) return;
  pi.events.emit(HERDR_BLOCKED_EVENT, { active: false });
}

function unblockWhere(
  pi: ExtensionAPI,
  predicate: (activeBlock: ActiveBlock) => boolean,
): void {
  for (const [key, activeBlock] of activeBlocks) {
    if (predicate(activeBlock)) unblock(pi, key);
  }
}

function notificationKey(kind: BlockKind, toolCallId?: string): string {
  return toolCallId ? `${kind}:${toolCallId}` : kind;
}

function handleDangerous(pi: ExtensionAPI): () => void {
  return pi.events.on(AD_NOTIFY_DANGEROUS_EVENT, (data) => {
    const payload = data as DangerousNotification;
    // Guardrails' own Herdr adapter tracks the approval prompt precisely.
    // This compatibility notification is still useful to other harness hooks,
    // but treating it as another Herdr block leaves an uncorrelated block.
    if (payload.source === "defaults:event-compat:guardrails") return;

    block(
      pi,
      notificationKey("dangerous", payload.toolCallId),
      { kind: "dangerous", toolCallId: payload.toolCallId },
      payload.description || "Dangerous action detected",
    );
  });
}

function handleAttention(pi: ExtensionAPI): () => void {
  return pi.events.on(AD_NOTIFY_ATTENTION_EVENT, (data) => {
    const payload = data as AdNotifyAttentionEvent;
    block(
      pi,
      notificationKey("attention", payload.toolCallId),
      { kind: "attention", toolCallId: payload.toolCallId },
      payload.description ?? payload.reason ?? "Waiting for user input",
    );
  });
}

function handleError(pi: ExtensionAPI): () => void {
  const stopListening = pi.events.on(AD_NOTIFY_DONE_EVENT, (data) => {
    const payload = data as AdNotifyDoneEvent;
    if (payload.status !== "error") return;

    block(pi, "error", { kind: "error" }, "An error occurred");
  });

  // A retry starts a new low-level agent run.
  pi.on("agent_start", () => {
    unblockWhere(pi, ({ kind }) => kind === "error");
  });

  // No agent_start follows the final failed retry, so settle the error here.
  pi.on("agent_settled", () => {
    unblockWhere(pi, ({ kind }) => kind === "error");
  });

  return stopListening;
}

export default function herdr(pi: ExtensionAPI): void {
  const stopListening = [
    handleError(pi),
    handleDangerous(pi),
    handleAttention(pi),
  ];

  pi.on("tool_execution_end", (event) => {
    unblockWhere(
      pi,
      ({ kind, toolCallId }) =>
        kind !== "error" && toolCallId === event.toolCallId,
    );
  });

  pi.on("agent_start", () => {
    unblockWhere(pi, ({ kind, toolCallId }) => kind !== "error" && !toolCallId);
  });

  pi.on("agent_settled", () => {
    unblockWhere(pi, ({ kind }) => kind !== "error");
  });

  pi.on("session_shutdown", () => {
    unblockWhere(pi, () => true);
    for (const stop of stopListening) stop();
  });
}
