import type {
  ApiStreamSimpleFunction,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";

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
      "x-claude-code-session-id": options?.sessionId,
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
