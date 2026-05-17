import {
  getOrThrow,
  getOrUndefined,
  err as piErr,
  ok as piOk,
  type Result,
  toError,
} from "@earendil-works/pi-agent-core";

export type { Result };

/** Create a successful Result. */
export function ok<TValue, TError = never>(
  value: TValue,
): Result<TValue, TError> {
  return piOk<TValue, TError>(value);
}

/** Create a failed Result. */
export function err<TValue = never, TError = Error>(
  error: TError,
): Result<TValue, TError> {
  return piErr<TValue, TError>(error);
}

export { getOrThrow, getOrUndefined, toError };

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
