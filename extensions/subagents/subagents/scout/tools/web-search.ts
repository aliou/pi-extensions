import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { routeSearch, ScoutRoutingError } from "../providers/router";
import type { ScoutProviderId } from "../providers/types";

const parameters = Type.Object({
  query: Type.String({ description: "Search query for web content" }),
});

interface WebSearchDetails {
  provider?: ScoutProviderId;
  resultCount?: number;
  router?: unknown;
  cost?: number;
  costCurrency?: "USD" | "EUR";
  error?: string;
}

function toMarkdown(
  items: Array<{
    title: string;
    url: string;
    text?: string;
    published?: string;
  }>,
): string {
  if (items.length === 0) return "No results found.";

  return items
    .map((item, index) => {
      const lines = [`${index + 1}. [${item.title}](${item.url})`];
      if (item.published) lines.push(`   - Published: ${item.published}`);
      if (item.text) lines.push(`   - ${item.text}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export const webSearchTool: ToolDefinition<
  typeof parameters,
  WebSearchDetails
> = {
  name: "web_search",
  label: "Web Search",
  description: "Search the web using configured provider order with fallback.",
  parameters,
  async execute(_toolCallId, args, signal) {
    try {
      const { result, diag } = await routeSearch({ query: args.query, signal });
      return {
        content: [{ type: "text" as const, text: toMarkdown(result.items) }],
        details: {
          provider: result.provider,
          resultCount: result.items.length,
          router: diag,
          cost: result.cost?.amount,
          costCurrency: result.cost?.currency,
        },
      };
    } catch (error) {
      const details: WebSearchDetails = {
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
