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

const LINKUP_BASE_URL = "https://api.linkup.so/v1";

export class LinkupProvider implements ScoutSearchProvider, ScoutFetchProvider {
  readonly id = "linkup" as const;
  readonly label = "Linkup";
  readonly capabilities = ["web_search", "web_fetch"] as const;

  private get apiKey(): string | undefined {
    return process.env.LINKUP_API_KEY;
  }

  isAvailable(): Availability {
    if (!this.apiKey) {
      return { ok: false, reason: "Missing LINKUP_API_KEY" };
    }
    return { ok: true };
  }

  async search(
    input: SearchInput,
    signal?: AbortSignal,
  ): Promise<SearchResult> {
    const config = getScoutWebConfig();
    const response = await fetch(`${LINKUP_BASE_URL}/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        query: input.query,
        depth: config.providers.linkup.searchDepth,
      }),
      signal,
    });

    const data = (await this.parseJson(response)) as {
      results?: Array<{
        name?: string;
        title?: string;
        url?: string;
        content?: string;
        publishedDate?: string;
      }>;
    };

    const items = (data.results ?? [])
      .filter((item) => !!item.url)
      .map((item) => ({
        title: item.title ?? item.name ?? item.url ?? "Untitled",
        url: item.url ?? "",
        text: item.content,
        published: item.publishedDate,
      }));

    const searchDepth = config.providers.linkup.searchDepth;

    return {
      provider: this.id,
      items,
      cost: {
        amount: searchDepth === "deep" ? 0.05 : 0.005,
        currency: "EUR",
        source: `linkup.estimated.search.${searchDepth}`,
      },
    };
  }

  async fetch(input: FetchInput, signal?: AbortSignal): Promise<FetchResult> {
    const config = getScoutWebConfig();
    const defaultRenderJs = config.providers.linkup.renderJsDefault;

    try {
      return await this.fetchOnce(input.url, defaultRenderJs, signal, false);
    } catch (error) {
      if (defaultRenderJs) throw error;
      return this.fetchOnce(input.url, true, signal, true);
    }
  }

  private async fetchOnce(
    url: string,
    renderJs: boolean,
    signal: AbortSignal | undefined,
    retried: boolean,
  ): Promise<FetchResult> {
    const response = await fetch(`${LINKUP_BASE_URL}/fetch`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        url,
        renderJs,
      }),
      signal,
    });

    const data = (await this.parseJson(response)) as {
      content?: string;
      markdown?: string;
      data?: { content?: string; markdown?: string };
    };

    const markdown =
      data.content ??
      data.markdown ??
      data.data?.content ??
      data.data?.markdown;
    if (!markdown) {
      throw new Error("Linkup fetch returned no content");
    }

    return {
      provider: this.id,
      markdown,
      cost: {
        amount: renderJs ? 0.02 : 0.01,
        currency: "EUR",
        source: `linkup.estimated.fetch.${renderJs ? "renderJs" : "standard"}`,
      },
      meta: retried ? { retryWithRenderJs: true } : undefined,
    };
  }

  private get headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error("Missing LINKUP_API_KEY");
    }
    return {
      "content-type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Linkup API error (${response.status}): ${text}`);
    }
    try {
      return text.length > 0 ? (JSON.parse(text) as unknown) : {};
    } catch {
      throw new Error("Linkup API returned invalid JSON");
    }
  }
}
