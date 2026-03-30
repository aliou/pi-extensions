import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  routeFetch,
  ScoutRoutingError,
} from "@subagents/scout/providers/router";
import type { ScoutProviderId } from "@subagents/scout/providers/types";

const parameters = Type.Object({
  url: Type.String({ description: "URL to fetch" }),
});

interface WebFetchDetails {
  provider?: ScoutProviderId;
  router?: unknown;
  cost?: number;
  costCurrency?: "USD" | "EUR";
  error?: string;
}

function normalizeUrl(raw: string): string {
  return new URL(raw).toString();
}

export const webFetchTool: ToolDefinition<typeof parameters, WebFetchDetails> =
  {
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch raw webpage/article content using configured provider order with fallback.",
    parameters,
    async execute(_toolCallId, args, signal) {
      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeUrl(args.url);
      } catch {
        return {
          content: [{ type: "text" as const, text: "Error: Invalid URL" }],
          details: { error: "Invalid URL" },
        };
      }

      try {
        const { result, diag } = await routeFetch({
          url: normalizedUrl,
          signal,
        });
        return {
          content: [{ type: "text" as const, text: result.markdown }],
          details: {
            provider: result.provider,
            router: diag,
            cost: result.cost?.amount,
            costCurrency: result.cost?.currency,
          },
        };
      } catch (error) {
        const details: WebFetchDetails = {
          error: error instanceof Error ? error.message : String(error),
        };

        if (error instanceof ScoutRoutingError) {
          details.router = error.diagnostics;
        }

        return {
          content: [{ type: "text" as const, text: `Error: ${details.error}` }],
          details,
        };
      }
    },
  };
