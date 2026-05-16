/** Result of a fallible operation. Expected failures are returned as `ok: false` instead of thrown. */
export type Result<TValue, TError> =
  | { ok: true; value: TValue }
  | { ok: false; error: TError };

/** Create a successful Result. */
export function ok<TValue, TError = never>(
  value: TValue,
): Result<TValue, TError> {
  return { ok: true, value };
}

/** Create a failed Result. */
export function err<TValue = never, TError = Error>(
  error: TError,
): Result<TValue, TError> {
  return { ok: false, error };
}

/** Return the success value or throw the failure error. Intended for tests and explicit adapter boundaries. */
export function getOrThrow<TValue, TError>(
  result: Result<TValue, TError>,
): TValue {
  if (isErr(result)) throw result.error;
  return result.value;
}

/** Narrow a Result to its success variant. */
export function isOk<TValue, TError>(
  result: Result<TValue, TError>,
): result is { ok: true; value: TValue } {
  return result.ok;
}

/** Narrow a Result to its failure variant. */
export function isErr<TValue, TError>(
  result: Result<TValue, TError>,
): result is { ok: false; error: TError } {
  return !result.ok;
}

/** Return the success value or `undefined`. Only object values are allowed to avoid truthiness bugs with primitives. */
export function getOrUndefined<TValue extends object, TError>(
  result: Result<TValue, TError>,
): TValue | undefined {
  return result.ok ? result.value : undefined;
}

/** Normalize unknown thrown values into Error instances before using them as typed error causes. */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);

  try {
    return new Error(JSON.stringify(error));
  } catch (_error) {
    void _error;
    return new Error(String(error));
  }
}
