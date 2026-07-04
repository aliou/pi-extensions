import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { TpsTelemetry } from "@harness/events";
import { MAX_PLAUSIBLE_TPS, type TurnTiming } from "./types";

/** Type guard: the message is an assistant message with usable usage info. */
export function isAssistantMessage(message: {
  role?: unknown;
}): message is AssistantMessage {
  return message.role === "assistant";
}

/**
 * Build structured telemetry from accumulated turn timing.
 * Returns null if the turn had no meaningful LLM output.
 *
 * Three-branch TPS gate (primary / fallback / null) plus a
 * MAX_PLAUSIBLE_TPS volume gate. Ported unchanged from pi-tps.
 */
export function buildTelemetry(
  timing: TurnTiming,
  turnEndMs: number,
): TpsTelemetry | null {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let totalTokens = 0;
  let costInput = 0;
  let costOutput = 0;
  let costCacheRead = 0;
  let costCacheWrite = 0;
  let costTotal = 0;
  let hasCost = false;
  let model: { provider: string; modelId: string } | null = null;

  for (const message of timing.assistantMessages) {
    input += message.usage.input || 0;
    output += message.usage.output || 0;
    cacheRead += message.usage.cacheRead || 0;
    cacheWrite += message.usage.cacheWrite || 0;
    totalTokens += message.usage.totalTokens || 0;
    if (message.usage.cost) {
      costInput += message.usage.cost.input || 0;
      costOutput += message.usage.cost.output || 0;
      costCacheRead += message.usage.cost.cacheRead || 0;
      costCacheWrite += message.usage.cost.cacheWrite || 0;
      costTotal += message.usage.cost.total || 0;
      hasCost = true;
    }
    if (!model && message.provider && message.model) {
      model = { provider: message.provider, modelId: message.model };
    }
  }

  if (output <= 0) return null;
  if (timing.firstTokenMs === null) return null;
  if (!model) return null;

  const totalMs = turnEndMs - timing.turnStartMs;

  // ── Generation TPS gate ───────────────────────────────────────────────
  // Primary:   ≥5 updates, avg inter-chunk gap ≥1ms, stalls don't dominate,
  //            effective span ≥200ms → output / (effectiveStreamMs / 1000)
  // Fallback:  ≥2 updates, generationMs ≥200ms → output / (effectiveGenMs / 1000)
  //            (includes TTFT, underestimates by design)
  // Else:      null — structurally unidentifiable
  const MIN_STREAM_MS = 1;
  const MIN_STREAM_UPDATES = 5;
  const MIN_INTER_CHUNK_MS = 1;
  const MIN_GENERATION_MS = 200;
  const ACTIVE_TIME_THRESHOLD_MS = 200;
  const STALL_REDUCTION_DENOM = 2;
  const STALL_DOMINANCE_RATIO = 0.85;

  const streamMs =
    timing.updateCount > 0 && timing.firstStreamUpdateMs !== null
      ? timing.lastStreamUpdateMs - timing.firstStreamUpdateMs
      : null;
  const avgInterChunkGap =
    streamMs !== null && timing.updateCount > 1
      ? streamMs / (timing.updateCount - 1)
      : 0;

  let tps: number | null = null;
  let isPrimaryBranch = false;
  if (
    streamMs !== null &&
    streamMs >= MIN_STREAM_MS &&
    timing.updateCount >= MIN_STREAM_UPDATES &&
    avgInterChunkGap >= MIN_INTER_CHUNK_MS &&
    timing.stallMs < streamMs &&
    streamMs - timing.stallMs >= MIN_GENERATION_MS &&
    timing.stallMs < streamMs - timing.stallMs
  ) {
    // Active generation time: streaming window minus known stalls.
    const effectiveStreamMs = streamMs - timing.stallMs;
    tps = Math.round((output / (effectiveStreamMs / 1000)) * 10) / 10;
    isPrimaryBranch = true;
  } else if (
    timing.updateCount >= 2 &&
    timing.totalGenerationMs >= MIN_GENERATION_MS
  ) {
    // Fallback: generationMs (message_start → message_end) minus stalls.
    // Includes TTFT, so it underestimates, but never overshoots.
    const stallsDominate =
      timing.totalGenerationMs - timing.stallMs < ACTIVE_TIME_THRESHOLD_MS ||
      timing.stallMs > timing.totalGenerationMs * STALL_DOMINANCE_RATIO;
    const effectiveGenMs = stallsDominate
      ? Math.max(
          timing.totalGenerationMs - timing.stallMs / STALL_REDUCTION_DENOM,
          MIN_GENERATION_MS,
        )
      : Math.max(timing.totalGenerationMs - timing.stallMs, MIN_GENERATION_MS);
    tps = Math.round((output / (effectiveGenMs / 1000)) * 10) / 10;
  }

  // Volume-based sanity gate: extraordinary TPS claims require proportionally
  // longer measurement windows. Equivalent to: computed TPS > MAX_PLAUSIBLE_TPS.
  if (tps !== null && tps > MAX_PLAUSIBLE_TPS) {
    tps = null;
    isPrimaryBranch = false;
  }

  return {
    model,
    tokens: { input, output, cacheRead, cacheWrite, total: totalTokens },
    timing: {
      ttftMs: timing.firstTokenMs - timing.turnStartMs,
      totalMs,
      generationMs: timing.totalGenerationMs,
      streamMs,
      stallMs: timing.stallMs,
      stallCount: timing.stallCount,
      messageCount: timing.messageCount,
    },
    tps,
    isPrimaryBranch,
    cost: hasCost
      ? {
          input: costInput,
          output: costOutput,
          cacheRead: costCacheRead,
          cacheWrite: costCacheWrite,
          total: costTotal,
        }
      : null,
    timestamp: Date.now(),
  };
}
