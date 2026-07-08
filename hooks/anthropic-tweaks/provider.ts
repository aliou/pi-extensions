import type { SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { ApiStreamSimpleFunction } from "@earendil-works/pi-ai/compat";

function withSessionHeader(
  options?: SimpleStreamOptions,
): SimpleStreamOptions | undefined {
  if (!options?.sessionId) {
    return;
  }

  return {
    ...options,
    headers: {
      ...options?.headers,
      "X-Session-Affinity": options?.sessionId,
    },
  };
}

export function createAnthropicStreamSimple(
  streamSimple: ApiStreamSimpleFunction,
): ApiStreamSimpleFunction {
  return (model, context, options) => {
    return streamSimple(model, context, withSessionHeader(options));
  };
}
