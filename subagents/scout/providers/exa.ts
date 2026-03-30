import { getScoutWebConfig } from "@subagents/config";
import type {
  Availability,
  FetchInput,
  FetchResult,
  ScoutFetchProvider,
  ScoutSearchProvider,
  SearchInput,
  SearchResult,
} from "@subagents/scout/providers/types";

const EXA_BASE_URL = "https://api.exa.ai";

export class ExaProvider implements ScoutSearchProvider, ScoutFetchProvider {
  readonly id = "exa" as const;
  readonly label = "Exa";
  readonly capabilities = ["web_search", "web_fetch"] as const;

  private get apiKey(): string | undefined {
    return process.env.EXA_API_KEY;
  }

  isAvailable(): Availability {
    if (!this.apiKey) {
      return { ok: false, reason: "Missing EXA_API_KEY" };
    }
    return { ok: true };
  }

  async search(
    input: SearchInput,
    signal?: AbortSignal,
  ): Promise<SearchResult> {
    const config = getScoutWebConfig();
    const response = await fetch(`${EXA_BASE_URL}/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        query: input.query,
        type: config.providers.exa.searchMode,
        numResults: 10,
      }),
      signal,
    });

    const data = (await this.parseJson(response)) as {
      results?: Array<{
        title?: string;
        url?: string;
        text?: string;
        publishedDate?: string;
      }>;
      costDollars?: { total?: number };
    };

    const items = (data.results ?? [])
      .filter((item) => !!item.url)
      .map((item) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        text: item.text,
        published: item.publishedDate,
      }));

    return {
      provider: this.id,
      items,
      cost:
        typeof data.costDollars?.total === "number"
          ? {
              amount: data.costDollars.total,
              currency: "USD",
              source: "exa.costDollars.total",
            }
          : undefined,
    };
  }

  async fetch(input: FetchInput, signal?: AbortSignal): Promise<FetchResult> {
    const response = await fetch(`${EXA_BASE_URL}/contents`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        urls: [input.url],
        text: true,
      }),
      signal,
    });

    const data = (await this.parseJson(response)) as {
      results?: Array<{ text?: string; markdown?: string; url?: string }>;
      costDollars?: { total?: number };
    };

    const first = data.results?.[0];
    const markdown = first?.text ?? first?.markdown;
    if (!markdown) {
      throw new Error("Exa fetch returned no content");
    }

    return {
      provider: this.id,
      markdown,
      cost:
        typeof data.costDollars?.total === "number"
          ? {
              amount: data.costDollars.total,
              currency: "USD",
              source: "exa.costDollars.total",
            }
          : undefined,
    };
  }

  private get headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error("Missing EXA_API_KEY");
    }
    return {
      "content-type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Exa API error (${response.status}): ${text}`);
    }
    try {
      return text.length > 0 ? (JSON.parse(text) as unknown) : {};
    } catch {
      throw new Error("Exa API returned invalid JSON");
    }
  }
}
