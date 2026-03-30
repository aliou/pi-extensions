export type ScoutProviderId = "exa" | "linkup" | "synthetic" | "markdownDotNew";
export type ScoutCapability = "web_search" | "web_fetch";

export interface AvailabilityOk {
  ok: true;
}

export interface AvailabilityFail {
  ok: false;
  reason: string;
}

export type Availability = AvailabilityOk | AvailabilityFail;

export interface SearchInput {
  query: string;
}

export interface FetchInput {
  url: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  text?: string;
  published?: string;
}

export interface ProviderCost {
  amount: number;
  currency: "USD" | "EUR";
  source?: string;
}

export interface SearchResult {
  provider: ScoutProviderId;
  items: SearchResultItem[];
  cost?: ProviderCost;
  meta?: Record<string, unknown>;
}

export interface FetchResult {
  provider: ScoutProviderId;
  markdown: string;
  cost?: ProviderCost;
  meta?: Record<string, unknown>;
}

export interface ScoutProviderBase {
  id: ScoutProviderId;
  label: string;
  capabilities: readonly ScoutCapability[];
  isAvailable(): Availability;
}

export interface ScoutSearchProvider extends ScoutProviderBase {
  search(input: SearchInput, signal?: AbortSignal): Promise<SearchResult>;
}

export interface ScoutFetchProvider extends ScoutProviderBase {
  fetch(input: FetchInput, signal?: AbortSignal): Promise<FetchResult>;
}
