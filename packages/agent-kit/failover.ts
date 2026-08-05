import type { SubagentModelChoice } from "./models";
import { type ProviderCooldown, providerCooldown } from "./models";
import {
  type AttemptFailure,
  classifyAttempt,
  isSubagentAttemptError,
} from "./runtime";
import {
  isStartupTimeoutError,
  type StartupBudget,
  withStartupTimeout,
} from "./startup-timeout";

export interface FailoverAttemptArgs<Owned> {
  choice: SubagentModelChoice;
  /** Aborts when the parent aborts, or when this attempt is abandoned. */
  signal: AbortSignal;
  /** Must be called on the attempt's first streamed output. */
  started: () => void;
  /**
   * Register a resource created by this attempt (its session). Kept per
   * attempt rather than in caller-side shared state: an abandoned attempt can
   * still be mid-setup when the next one starts, and a late registration must
   * not be attributed to the wrong attempt.
   */
  own: (resource: Owned) => void;
}

export interface FailoverSettled<Owned> {
  choice: SubagentModelChoice;
  /** Absent when the attempt answered. */
  failure?: AttemptFailure;
  /** Whatever this attempt registered through `own`, if anything. */
  owned?: Owned;
}

export interface FailoverOptions<T, Owned = unknown> {
  label: string;
  candidates: readonly SubagentModelChoice[];
  budget: StartupBudget;
  signal?: AbortSignal;
  cooldown?: ProviderCooldown;
  notify: (message: string) => void;
  runAttempt: (args: FailoverAttemptArgs<Owned>) => Promise<T>;
  /** Called once per attempt, after it settles, before the loop moves on. */
  onSettled?: (settled: FailoverSettled<Owned>) => void;
}

export interface FailoverResult<T> {
  result: T;
  choice: SubagentModelChoice;
  /** `provider/model` labels in attempt order; the last one answered. */
  attempted: string[];
}

/**
 * Walk a ranked candidate list until one answers.
 *
 * Only pre-start provider failures advance: once an attempt has streamed
 * output, a fresh session on another model would silently drop it, so those
 * failures are fatal. Provider-scoped failures also drop the rest of that
 * provider's entries for this invocation and arm its cooldown, so the next
 * spawn does not re-probe it.
 */
export async function runWithFailover<T, Owned = unknown>(
  options: FailoverOptions<T, Owned>,
): Promise<FailoverResult<T>> {
  const cooldown = options.cooldown ?? providerCooldown;
  let remaining = [...options.candidates];
  const attempted: string[] = [];
  let firstError: unknown;
  let stopReason = "every candidate failed";

  while (remaining.length > 0) {
    options.signal?.throwIfAborted();

    const windowMs = options.budget.nextWindow();
    if (windowMs <= 0) {
      stopReason = "startup budget exhausted";
      break;
    }

    const choice = remaining[0] as SubagentModelChoice;
    remaining = remaining.slice(1);
    const label = modelLabel(choice);
    attempted.push(label);

    // Per-attempt abort, so an abandoned attempt is told to stop instead of
    // streaming into a session nobody is waiting for any more.
    const abandon = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([options.signal, abandon.signal])
      : abandon.signal;
    // Scoped to this iteration, so a late `own` from an abandoned attempt
    // cannot be attributed to the attempt that replaced it.
    let owned: Owned | undefined;
    let settled: FailoverSettled<Owned> | undefined;
    const own = (resource: Owned) => {
      owned = resource;
      // An abandoned attempt can finish its setup after the loop moved on.
      // Re-notify so the caller can discard the resource it just created.
      if (settled) options.onSettled?.({ ...settled, owned: resource });
    };
    const settle = (result: FailoverSettled<Owned>) => {
      settled = result;
      options.onSettled?.(result);
    };

    try {
      const result = await withStartupTimeout(
        (started) =>
          options.runAttempt({
            choice,
            signal,
            started: () => {
              options.budget.markStarted();
              started();
            },
            own,
          }),
        options.label,
        windowMs,
      );
      settle({ choice, owned });
      return { result, choice, attempted };
    } catch (error) {
      const failure = toAttemptFailure(error, choice);
      const classification = classifyAttempt(failure);
      settle({ choice, failure, owned });
      if (!failure.started) abandon.abort();

      firstError ??= error;

      if (classification.action === "fatal") throw error;

      if (classification.cooldown === "provider") {
        cooldown.record(choice.preference.provider);
        remaining = remaining.filter(
          (entry) => entry.preference.provider !== choice.preference.provider,
        );
      }

      const next = remaining[0];
      options.notify(
        next
          ? `[model] ${label} failed (${classification.reason}), trying ${modelLabel(next)}`
          : `[model] ${label} failed (${classification.reason}), no candidates left`,
      );
    }
  }

  throw new Error(
    `${options.label} subagent: ${stopReason} (tried ${attempted.join(", ")}). First error: ${errorMessage(firstError)}`,
  );
}

export function modelLabel(choice: SubagentModelChoice): string {
  return `${choice.preference.provider}/${choice.preference.model}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Normalize whatever an attempt threw into the shape `classifyAttempt` reads.
 * Anything that is neither a runtime failure nor a startup stall came from our
 * own setup and is fatal by construction.
 */
export function toAttemptFailure(
  error: unknown,
  choice: SubagentModelChoice,
): AttemptFailure {
  if (isSubagentAttemptError(error)) return error.failure;

  const provider = choice.preference.provider;
  const model = choice.preference.model;
  if (isStartupTimeoutError(error)) {
    return {
      phase: "startup-timeout",
      started: false,
      aborted: false,
      cause: error,
      provider,
      model,
      message: error.message,
    };
  }

  return {
    phase: "setup",
    started: false,
    aborted: false,
    cause: error,
    provider,
    model,
    message: errorMessage(error),
  };
}
