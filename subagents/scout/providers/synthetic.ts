import type {
  Availability,
  ScoutSearchProvider,
  SearchInput,
  SearchResult,
} from "@subagents/scout/providers/types";

const SYNTHETIC_BASE_URL = "https://api.synthetic.new/v2";

export class SyntheticProvider implements ScoutSearchProvider {
  readonly id = "synthetic" as const;
  readonly label = "Synthetic";
  readonly capabilities = ["web_search"] as const;

  private get apiKey(): string | undefined {
    return process.env.SYNTHETIC_API_KEY;
  }

  isAvailable(): Availability {
    if (!this.apiKey) {
      return { ok: false, reason: "Missing SYNTHETIC_API_KEY" };
    }
    return { ok: true };
  }

  async search(
    input: SearchInput,
    signal?: AbortSignal,
  ): Promise<SearchResult> {
    const response = await fetch(`${SYNTHETIC_BASE_URL}/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query: input.query }),
      signal,
    });

    const data = (await this.parseJson(response)) as {
      results?: Array<{
        title?: string;
        url?: string;
        snippet?: string;
        content?: string;
        publishedAt?: string;
      }>;
    };

    const items = (data.results ?? [])
      .filter((item) => !!item.url)
      .map((item) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        text: item.content ?? item.snippet,
        published: item.publishedAt,
      }));

    return {
      provider: this.id,
      items,
    };
  }

  private get headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error("Missing SYNTHETIC_API_KEY");
    }
    return {
      "content-type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Synthetic API error (${response.status}): ${text}`);
    }
    try {
      return text.length > 0 ? (JSON.parse(text) as unknown) : {};
    } catch {
      throw new Error("Synthetic API returned invalid JSON");
    }
  }
}
