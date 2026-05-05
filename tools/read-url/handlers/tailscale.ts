import type { HandlerData, ReadUrlHandler } from "./types";

function createTimeoutSignal(
  timeoutMs: number,
  signal?: AbortSignal,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeoutSignal;
  return AbortSignal.any([signal, timeoutSignal]);
}

const TS_NET_TIMEOUT_MS = 10_000;

export function createTailscaleHandler(): ReadUrlHandler {
  return {
    name: "tailscale",
    matches(url: URL): boolean {
      return url.hostname.endsWith(".ts.net");
    },
    async fetchData(
      url: URL,
      signal: AbortSignal | undefined,
    ): Promise<HandlerData> {
      const response = await fetch(url.toString(), {
        signal: createTimeoutSignal(TS_NET_TIMEOUT_MS, signal),
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText || "Error"}${body ? ` - ${body.slice(0, 500)}` : ""}`,
        );
      }

      return {
        sourceUrl: url.toString(),
        markdown: body.trimEnd(),
        statusCode: response.status,
        statusText: response.statusText,
      };
    },
  };
}
