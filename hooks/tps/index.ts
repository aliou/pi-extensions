import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AD_TPS_TELEMETRY_EVENT } from "@harness/events";
import { STALL_THRESHOLD_MS, type TurnTiming } from "./types";
import { buildTelemetry, isAssistantMessage } from "./utils";

/**
 * pi-tps (minimal) — per-turn tokens-per-second tracker.
 *
 * Captures structured telemetry at every LLM turn and emits a single
 * `ad:tps:telemetry` event. No UI, no persistence, no commands.
 *
 * Subscribe with: `pi.events.on("ad:tps:telemetry", (t) => ...)`.
 *
 * Calculation (three-branch TPS gate + volume gate) and dynamic per-model
 * cap are ported unchanged from the pi-tps extension.
 */
export default function tps(pi: ExtensionAPI): void {
  // Current turn timing state, created on turn_start and consumed on turn_end.
  let currentTiming: TurnTiming | null = null;

  // Per-model TPS cap: highest reliable (primary-branch, non-tool-call) TPS
  // observed. Tool-call turns get clamped to this value to prevent inflation
  // from short outputs over tiny time windows. In-memory only; resets on restart.
  const tpsCaps = new Map<string, number>(); // "provider:modelId" → cap

  // ── Turn lifecycle ──────────────────────────────────────────────────────

  pi.on("turn_start", () => {
    const now = performance.now();
    currentTiming = {
      turnStartMs: now,
      lastUpdateMs: now,
      firstTokenMs: null,
      currentMessageStartMs: null,
      assistantMessages: [],
      totalGenerationMs: 0,
      updateCount: 0,
      firstStreamUpdateMs: null,
      lastStreamUpdateMs: 0,
      stallMs: 0,
      stallCount: 0,
      inStall: false,
      messageCount: 0,
      isToolCall: false,
      isPrimaryBranch: false,
    };
  });

  // message_start fires at stream creation, before any tokens. Defer TTFT to
  // the first message_update. Reset the stall clock so inter-message gaps
  // (tool execution) aren't counted as inference stalls.
  pi.on("message_start", (event) => {
    if (!currentTiming) return;
    if (!isAssistantMessage(event.message)) return;
    const now = performance.now();
    currentTiming.currentMessageStartMs = now;
    currentTiming.messageCount++;
    currentTiming.lastUpdateMs = now;
    currentTiming.inStall = false;
  });

  // Token-by-token updates during streaming: TTFT capture + stall detection.
  pi.on("message_update", (event) => {
    if (!currentTiming) return;
    if (!isAssistantMessage(event.message)) return;
    const now = performance.now();

    // First update = effective first token. Seed TTFT, no stall detection
    // here (the gap from message_start is provider parsing overhead).
    if (currentTiming.firstTokenMs === null) {
      currentTiming.firstTokenMs = now;
      currentTiming.lastUpdateMs = now;
      return;
    }

    // Track inter-update streaming span for TPS calculation.
    currentTiming.updateCount++;
    if (currentTiming.firstStreamUpdateMs === null) {
      currentTiming.firstStreamUpdateMs = now;
    }
    currentTiming.lastStreamUpdateMs = now;

    const gap = now - currentTiming.lastUpdateMs;
    // Full gap counts as stall time — the threshold is a detection gate,
    // not a duration discount.
    if (gap >= STALL_THRESHOLD_MS) {
      if (!currentTiming.inStall) currentTiming.stallCount++;
      currentTiming.inStall = true;
      currentTiming.stallMs += gap;
    } else {
      currentTiming.inStall = false;
    }
    currentTiming.lastUpdateMs = now;
  });

  // Mark this turn as a tool call so the dynamic cap clamps its TPS.
  pi.on("tool_execution_start", () => {
    if (!currentTiming) return;
    currentTiming.isToolCall = true;
  });

  pi.on("message_end", (event) => {
    if (!currentTiming) return;
    if (!isAssistantMessage(event.message)) return;
    const now = performance.now();

    // Accumulate actual streaming time for this message (true generation time).
    if (currentTiming.currentMessageStartMs !== null) {
      currentTiming.totalGenerationMs +=
        now - currentTiming.currentMessageStartMs;
      currentTiming.currentMessageStartMs = null;
    }

    // Stash the message to count its tokens later (only current turn's).
    currentTiming.assistantMessages.push(event.message);
    currentTiming.lastUpdateMs = now;
  });

  // ── Calculate, cap, emit ────────────────────────────────────────────────

  pi.on("turn_end", () => {
    if (!currentTiming) return;
    const timing = currentTiming;
    currentTiming = null;

    const telemetry = buildTelemetry(timing, performance.now());
    if (!telemetry) return;

    const modelKey = `${telemetry.model.provider}:${telemetry.model.modelId}`;

    // Only non-tool, primary-branch (reliable) measurements raise the cap.
    if (telemetry.isPrimaryBranch && telemetry.tps !== null) {
      const currentCap = tpsCaps.get(modelKey);
      if (currentCap === undefined || telemetry.tps > currentCap) {
        tpsCaps.set(modelKey, telemetry.tps);
      }
    }

    // Tool-call turns get clamped to the cap (or nulled if no cap yet).
    if (timing.isToolCall && telemetry.tps !== null) {
      const cap = tpsCaps.get(modelKey);
      telemetry.tps = cap !== undefined ? Math.min(telemetry.tps, cap) : null;
    }

    pi.events.emit(AD_TPS_TELEMETRY_EVENT, telemetry);
  });
}
