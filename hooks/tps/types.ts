import type { AssistantMessage } from "@earendil-works/pi-ai";

// ─── In-memory turn accumulator ───────────────────────────────────────────
// Internal to this hook. The emitted shape lives in @harness/events (TpsTelemetry).

export interface TurnTiming {
  turnStartMs: number;
  lastUpdateMs: number;
  firstTokenMs: number | null;
  currentMessageStartMs: number | null;
  assistantMessages: AssistantMessage[];
  totalGenerationMs: number;
  // Inter-update TPS tracking: streaming span between the first and last
  // non-TTFT message_update events.
  updateCount: number;
  firstStreamUpdateMs: number | null;
  lastStreamUpdateMs: number;
  stallMs: number;
  stallCount: number;
  inStall: boolean;
  messageCount: number;
  isToolCall: boolean;
  isPrimaryBranch: boolean;
}

// ─── Tunables ─────────────────────────────────────────────────────────────

/** Minimum gap between token updates to count as a stall (ms). */
export const STALL_THRESHOLD_MS = 500;

/**
 * Maximum plausible generation speed (tokens/second). Beyond this, measured
 * TPS is almost certainly a measurement artifact — the effective generation
 * window is too short relative to the token volume to distinguish genuine
 * inference from a buffer-flush dispatch of pre-generated tokens.
 */
export const MAX_PLAUSIBLE_TPS = 10_000;
