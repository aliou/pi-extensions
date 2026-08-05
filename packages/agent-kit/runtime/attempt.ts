import {
  type AssistantMessage,
  isContextOverflow,
  isRetryableAssistantError,
} from "@earendil-works/pi-ai";

/**
 * Where a subagent attempt died. Everything before `prompt` is our own setup
 * and fails identically on every roster entry, so those phases are never
 * retried on another model.
 */
export type AttemptPhase =
  | "setup"
  | "build-prompt"
  | "before-execute"
  | "prompt"
  | "blank-response"
  | "startup-timeout";

export interface AttemptFailure {
  phase: AttemptPhase;
  /** True once the attempt streamed any output (tokens, thinking, tool call). */
  started: boolean;
  aborted: boolean;
  /** Original error, preserved for the fatal path. */
  cause: unknown;
  /** Raw provider message, when the failure came from the provider. */
  assistant?: AssistantMessage;
  provider: string;
  model: string;
  message: string;
}

export class SubagentAttemptError extends Error {
  readonly failure: AttemptFailure;

  constructor(failure: AttemptFailure) {
    // Name the model in the message: a fatal failure reaches the parent as-is,
    // and "which model produced this" is the first thing it needs to decide
    // whether to retry, narrow the request, or give up.
    super(`${failure.provider}/${failure.model}: ${failure.message}`);
    this.name = "SubagentAttemptError";
    this.failure = failure;
  }
}

export function isSubagentAttemptError(
  error: unknown,
): error is SubagentAttemptError {
  return error instanceof SubagentAttemptError;
}

export type AttemptAction = "fatal" | "next-entry";
export type AttemptCooldown = "none" | "provider";

export interface AttemptClassification {
  action: AttemptAction;
  cooldown: AttemptCooldown;
  /** Short tag used in notifications and the aggregated error. */
  reason: string;
}

/**
 * Quota, budget, and billing exhaustion. `isRetryableAssistantError` returns
 * false for these on purpose (retrying the same provider is pointless), which
 * is exactly why they must fail over to another provider.
 */
const QUOTA_PATTERN =
  /\b402\b|payment required|insufficient[_ ]quota|insufficient (?:credit|balance|funds)|out of budget|quota exceeded|usage limit|billing|credits? (?:exhausted|remaining)/i;

/**
 * Decide what a failed attempt means for the failover loop.
 *
 * The operative rule is provenance, not status parsing: a pre-start failure
 * that carries a provider message (or a startup stall) is a provider failure
 * and advances to the next roster entry; a bare exception from our own setup
 * is fatal. Text matching only picks the cooldown and the wording.
 */
export function classifyAttempt(
  failure: AttemptFailure,
): AttemptClassification {
  if (failure.aborted) {
    return { action: "fatal", cooldown: "none", reason: "aborted" };
  }

  // Output already reached the caller; a fresh session on another model would
  // silently drop it, so post-start failures stay fatal.
  if (failure.started) {
    return { action: "fatal", cooldown: "none", reason: "failed-after-start" };
  }

  if (failure.phase === "startup-timeout") {
    return { action: "next-entry", cooldown: "provider", reason: "no output" };
  }

  if (
    failure.phase === "setup" ||
    failure.phase === "build-prompt" ||
    failure.phase === "before-execute"
  ) {
    return { action: "fatal", cooldown: "none", reason: failure.phase };
  }

  const assistant = failure.assistant;
  if (!assistant) {
    // Pre-start throw with no provider response: our bug, or an unusable
    // session. Every other entry would fail the same way.
    return {
      action: "fatal",
      cooldown: "none",
      reason: "no provider response",
    };
  }

  if (assistant.stopReason === "aborted") {
    return { action: "fatal", cooldown: "none", reason: "aborted" };
  }

  if (isContextOverflow(assistant)) {
    return { action: "fatal", cooldown: "none", reason: "context overflow" };
  }

  if (assistant.stopReason !== "error") {
    // A clean completion that simply said nothing. Another model would most
    // likely say nothing too, and the parent needs to see the blank result.
    return { action: "fatal", cooldown: "none", reason: "blank response" };
  }

  if (QUOTA_PATTERN.test(assistant.errorMessage ?? "")) {
    return { action: "next-entry", cooldown: "provider", reason: "quota" };
  }

  if (isRetryableAssistantError(assistant)) {
    // pi already exhausted its in-provider retry budget before surfacing this.
    // Covers overload, 429/5xx, and connection-level transport failures.
    return { action: "next-entry", cooldown: "provider", reason: "transient" };
  }

  // Deterministic model-level rejections (404 model, 400 invalid input,
  // content policy). Another model can still answer; the provider is fine.
  return { action: "next-entry", cooldown: "none", reason: "provider error" };
}
