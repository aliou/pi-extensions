import type {
  ApiStreamSimpleFunction,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";

function withSessionHeader(
  options?: SimpleStreamOptions,
): SimpleStreamOptions | undefined {
  return {
    ...options,
    headers: {
      ...options?.headers,
      "x-session-id": options?.sessionId as string,
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
