/**
 * Startup (time-to-first-token) timeout for a subagent run.
 *
 * Covers setup AND the model call: pi-core's `createAgentSession` does not
 * accept an abort signal, so a hang in setup can't be stopped — the only way to
 * surface it is to stop awaiting. This races the run against a timer that is
 * disarmed the moment the subagent streams its first output, so a healthy
 * long-running call is never cancelled, while a stalled start (setup hang or a
 * connect-but-no-tokens transport) rejects with a clear error.
 */
export const SUBAGENT_STARTUP_TIMEOUT_MS = 60_000;

export function startupTimeoutError(
  label: string,
  timeoutMs: number = SUBAGENT_STARTUP_TIMEOUT_MS,
): Error {
  const window =
    timeoutMs < 1000 ? `${timeoutMs}ms` : `${Math.round(timeoutMs / 1000)}s`;
  return new Error(
    `${label} subagent did not start within ${window} — it produced no output. The provider transport may have stalled; retry the call or check the provider.`,
  );
}

/**
 * Run `work` raced against a startup timeout. `work` receives a `started`
 * callback it must invoke once the subagent streams its first output; that
 * disarms the timer. If the timer fires first, rejects with
 * {@link startupTimeoutError}. The underlying work is left to settle on its own
 * (setup is not abortable); a late rejection is suppressed so it can't become
 * unhandled.
 */
export async function withStartupTimeout<T>(
  work: (started: () => void) => Promise<T>,
  label: string,
  // Overridable only for tests that need a real (non-faked) clock; production
  // call sites always use the default.
  timeoutMs: number = SUBAGENT_STARTUP_TIMEOUT_MS,
): Promise<T> {
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
