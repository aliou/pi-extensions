import type { SimpleStreamOptions } from "@earendil-works/pi-ai";
import {
  type ApiStreamSimpleFunction,
  getApiProvider,
} from "@earendil-works/pi-ai/compat";
import type { ProviderConfig } from "@earendil-works/pi-coding-agent";
import type { Optional } from "@harness/utils";

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

function createAnthropicStreamSimple(
  streamSimple: ApiStreamSimpleFunction,
): ApiStreamSimpleFunction {
  return (model, context, options) => {
    return streamSimple(model, context, withSessionHeader(options));
  };
}

/** Adds `X-Session-Affinity` to Anthropic provider requests. */
export function getAnthropicProvider(): Optional<ProviderConfig> {
  const builtIn = getApiProvider("anthropic-messages");
  if (!builtIn?.streamSimple) return;

  return {
    api: "anthropic-messages",
    streamSimple: createAnthropicStreamSimple(builtIn.streamSimple),
  };
}
