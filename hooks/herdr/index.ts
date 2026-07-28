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

// True while an agent run is in progress (between agent_start and
// agent_settled). Retries fire a new agent_start inside the same run, so
// only the first agent_start after a settle is a fresh user turn.
let runActive = false;

export function _resetForTesting(): void {
  activeBlocks.clear();
  runActive = false;
}

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
  return pi.events.on(AD_NOTIFY_DONE_EVENT, (data) => {
    const payload = data as AdNotifyDoneEvent;
    if (payload.status === "error") {
      block(pi, "error", { kind: "error" }, "An error occurred");
    } else if (payload.status === "ok") {
      // A successful run resolves a prior error block (e.g. a retry that
      // recovered). No-op when no error block is active.
      unblock(pi, "error");
    }
  });
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
    // A retry continues the same agent run: agent_start fires again before
    // agent_settled, so only the first agent_start of a user turn is fresh.
    // Error blocks persist across retries; clear one only on a fresh turn.
    const freshTurn = !runActive;
    runActive = true;
    unblockWhere(pi, ({ kind, toolCallId }) => kind !== "error" && !toolCallId);
    if (freshTurn) unblock(pi, "error");
  });

  pi.on("agent_settled", () => {
    runActive = false;
    // Non-error blocks (attention/dangerous) are per-run. Error blocks
    // persist until a successful run, the next user turn, or shutdown.
    unblockWhere(pi, ({ kind }) => kind !== "error");
  });

  pi.on("session_shutdown", () => {
    runActive = false;
    unblockWhere(pi, () => true);
    for (const stop of stopListening) stop();
  });
}
