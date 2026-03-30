import { getScoutWebConfig } from "@subagents/config";
import { createScoutProviders } from "@subagents/scout/providers/index";
import type {
  FetchResult,
  ScoutCapability,
  ScoutFetchProvider,
  ScoutProviderBase,
  ScoutProviderId,
  ScoutSearchProvider,
  SearchResult,
} from "@subagents/scout/providers/types";

export interface RouterAttempt {
  provider: ScoutProviderId;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  ok: boolean;
  error?: string;
  cost?: { amount: number; currency: "USD" | "EUR" };
}

export interface RouterDiagnostics {
  capability: ScoutCapability;
  order: ScoutProviderId[];
  unavailable: Array<{ provider: ScoutProviderId; reason: string }>;
  attempts: RouterAttempt[];
  selected?: ScoutProviderId;
}

export class ScoutRoutingError extends Error {
  constructor(
    message: string,
    readonly diagnostics: RouterDiagnostics,
  ) {
    super(message);
    this.name = "ScoutRoutingError";
  }
}

function isSearchProvider(
  provider: ScoutProviderBase,
): provider is ScoutSearchProvider {
  return provider.capabilities.includes("web_search");
}

function isFetchProvider(
  provider: ScoutProviderBase,
): provider is ScoutFetchProvider {
  return provider.capabilities.includes("web_fetch");
}

export async function routeSearch(input: {
  query: string;
  signal?: AbortSignal;
}): Promise<{ result: SearchResult; diag: RouterDiagnostics }> {
  const config = getScoutWebConfig();
  const providers = createScoutProviders();

  const diag: RouterDiagnostics = {
    capability: "web_search",
    order: [...config.searchOrder],
    unavailable: [],
    attempts: [],
  };

  for (const providerId of config.searchOrder) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider || !isSearchProvider(provider)) {
      continue;
    }

    if (!isEnabled(provider.id)) {
      diag.unavailable.push({
        provider: provider.id,
        reason: "Disabled in settings",
      });
      continue;
    }

    const availability = provider.isAvailable();
    if (!availability.ok) {
      diag.unavailable.push({
        provider: provider.id,
        reason: availability.reason,
      });
      continue;
    }

    const attempt: RouterAttempt = {
      provider: provider.id,
      startedAt: Date.now(),
      ok: false,
    };
    diag.attempts.push(attempt);

    try {
      const result = await provider.search(
        { query: input.query },
        input.signal,
      );
      attempt.ok = true;
      attempt.endedAt = Date.now();
      attempt.durationMs = attempt.endedAt - attempt.startedAt;
      attempt.cost = result.cost
        ? { amount: result.cost.amount, currency: result.cost.currency }
        : undefined;
      diag.selected = provider.id;
      return { result, diag };
    } catch (error) {
      attempt.ok = false;
      attempt.endedAt = Date.now();
      attempt.durationMs = attempt.endedAt - attempt.startedAt;
      attempt.error = error instanceof Error ? error.message : String(error);
    }
  }

  throw new ScoutRoutingError(
    "No web search provider could fulfill request",
    diag,
  );
}

export async function routeFetch(input: {
  url: string;
  signal?: AbortSignal;
}): Promise<{ result: FetchResult; diag: RouterDiagnostics }> {
  const config = getScoutWebConfig();
  const providers = createScoutProviders();

  const diag: RouterDiagnostics = {
    capability: "web_fetch",
    order: [...config.fetchOrder],
    unavailable: [],
    attempts: [],
  };

  for (const providerId of config.fetchOrder) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider || !isFetchProvider(provider)) {
      continue;
    }

    if (!isEnabled(provider.id)) {
      diag.unavailable.push({
        provider: provider.id,
        reason: "Disabled in settings",
      });
      continue;
    }

    const availability = provider.isAvailable();
    if (!availability.ok) {
      diag.unavailable.push({
        provider: provider.id,
        reason: availability.reason,
      });
      continue;
    }

    const attempt: RouterAttempt = {
      provider: provider.id,
      startedAt: Date.now(),
      ok: false,
    };
    diag.attempts.push(attempt);

    try {
      const result = await provider.fetch({ url: input.url }, input.signal);
      attempt.ok = true;
      attempt.endedAt = Date.now();
      attempt.durationMs = attempt.endedAt - attempt.startedAt;
      attempt.cost = result.cost
        ? { amount: result.cost.amount, currency: result.cost.currency }
        : undefined;
      diag.selected = provider.id;
      return { result, diag };
    } catch (error) {
      attempt.ok = false;
      attempt.endedAt = Date.now();
      attempt.durationMs = attempt.endedAt - attempt.startedAt;
      attempt.error = error instanceof Error ? error.message : String(error);
    }
  }

  throw new ScoutRoutingError(
    "No web fetch provider could fulfill request",
    diag,
  );
}

function isEnabled(providerId: ScoutProviderId): boolean {
  const config = getScoutWebConfig();
  if (providerId === "exa") return config.providers.exa.enabled;
  if (providerId === "linkup") return config.providers.linkup.enabled;
  if (providerId === "markdownDotNew")
    return config.providers.markdownDotNew.enabled;
  return config.providers.synthetic.enabled;
}
