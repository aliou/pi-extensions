import type {
  Availability,
  FetchInput,
  FetchResult,
  ScoutFetchProvider,
} from "@subagents/scout/providers/types";

const MARKDOWNNEW_BASE_URL = "https://markdown.new";

/**
 * Markdown New provider - free URL-to-markdown conversion.
 * Fetch only (no search). 500 requests/day/IP limit.
 */
export class MarkdownNewProvider implements ScoutFetchProvider {
  readonly id = "markdownDotNew" as const;
  readonly label = "Markdown New";
  readonly capabilities = ["web_fetch"] as const;

  isAvailable(): Availability {
    return { ok: true };
  }

  async fetch(input: FetchInput, signal?: AbortSignal): Promise<FetchResult> {
    const response = await fetch(MARKDOWNNEW_BASE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: input.url, retain_images: true }),
      signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Markdown New API error (${response.status}): ${text}`);
    }

    const data = JSON.parse(text) as {
      content?: string;
      tokens?: number;
      method?: string;
    };

    const markdown = data.content;
    if (!markdown) {
      throw new Error("Markdown New returned no content");
    }

    const rateLimitRemaining = response.headers.get("x-rate-limit-remaining");

    return {
      provider: this.id,
      markdown,
      meta: {
        ...(data.tokens != null ? { markdownTokens: data.tokens } : {}),
        ...(data.method ? { method: data.method } : {}),
        ...(rateLimitRemaining != null
          ? { rateLimitRemaining: Number(rateLimitRemaining) }
          : {}),
      },
    };
  }
}
