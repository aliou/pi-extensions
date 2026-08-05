/**
 * Startup (time-to-first-token) timeouts for subagent attempts.
 *
 * Covers setup AND the model call: pi-core's `createAgentSession` does not
 * accept an abort signal, so a hang in setup can't be stopped — the only way to
 * surface it is to stop awaiting. Each attempt races against a timer that is
 * disarmed the moment the subagent streams its first output, so a healthy
 * long-running call is never cancelled, while a stalled start (setup hang or a
 * connect-but-no-tokens transport) rejects with a clear error.
 *
 * A stall is the strongest available signal that a provider is dead: it is the
 * one failure mode that produces no error to classify. The failover loop treats
 * a pre-start expiry as "try the next roster entry", so the timer is armed per
 * attempt and {@link createStartupBudget} caps the whole invocation to keep
 * several stalling providers from stacking full windows.
 */

/** Per-attempt time-to-first-token window. */
export const ATTEMPT_STARTUP_TIMEOUT_MS = 25_000;

/** Invocation-wide startup budget shared by every attempt. */
export const SUBAGENT_STARTUP_TIMEOUT_MS = 60_000;

export class StartupTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartupTimeoutError";
  }
}

export function isStartupTimeoutError(
  error: unknown,
): error is StartupTimeoutError {
  return error instanceof StartupTimeoutError;
}

export function startupTimeoutError(
  label: string,
  timeoutMs: number = SUBAGENT_STARTUP_TIMEOUT_MS,
): StartupTimeoutError {
  const window =
    timeoutMs < 1000 ? `${timeoutMs}ms` : `${Math.round(timeoutMs / 1000)}s`;
  return new StartupTimeoutError(
    `${label} subagent did not start within ${window} — it produced no output. The provider transport may have stalled; retry the call or check the provider.`,
  );
}

export interface StartupBudget {
  /** True once some attempt streamed output; timers stay disarmed after that. */
  readonly started: boolean;
  markStarted(): void;
  /**
   * Window for the next attempt: the per-attempt cap, shortened by whatever is
   * left of the invocation budget. Zero means the budget is spent and no
   * further attempt should be made.
   */
  nextWindow(): number;
}

export function createStartupBudget(
  options: { totalMs?: number; attemptMs?: number; now?: () => number } = {},
): StartupBudget {
  const totalMs = options.totalMs ?? SUBAGENT_STARTUP_TIMEOUT_MS;
  const attemptMs = options.attemptMs ?? ATTEMPT_STARTUP_TIMEOUT_MS;
  const now = options.now ?? (() => Date.now());
  const begin = now();
  let started = false;

  return {
    get started() {
      return started;
    },
    markStarted() {
      started = true;
    },
    nextWindow() {
      if (started) return Number.POSITIVE_INFINITY;
      const remaining = totalMs - (now() - begin);
      if (remaining <= 0) return 0;
      return Math.min(attemptMs, remaining);
    },
  };
}

/**
 * Run `work` raced against a startup timeout. `work` receives a `started`
 * callback it must invoke once the subagent streams its first output; that
 * disarms the timer. If the timer fires first, rejects with
 * {@link startupTimeoutError}. The underlying work is left to settle on its own
 * (setup is not abortable); a late rejection is suppressed so it can't become
 * unhandled. A non-finite `timeoutMs` disables the race entirely.
 */
export async function withStartupTimeout<T>(
  work: (started: () => void) => Promise<T>,
  label: string,
  // Overridable only for tests that need a real (non-faked) clock, and by the
  // failover loop, which shortens the window to what the budget allows.
  timeoutMs: number = SUBAGENT_STARTUP_TIMEOUT_MS,
): Promise<T> {
  if (!Number.isFinite(timeoutMs)) return work(() => {});

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(startupTimeoutError(label, timeoutMs)),
      timeoutMs,
    );
  });
  const started = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  const workPromise = work(started);
  workPromise.catch(() => {});
  try {
    return await Promise.race([workPromise, timeout]);
  } finally {
    started();
  }
}
