import {
  getCachedProvider,
  type NormalizedLimit,
  type ProviderId,
  type ProviderSnapshot,
  writeProviderCache,
} from "@harness/provider-usage";
import type { HistoryLine } from "./types";

function providerFromHistoryId(id: string): ProviderId | null {
  if (id.startsWith("anthropic:")) return "anthropic";
  if (id.startsWith("codex:")) return "openai-codex";
  if (id.startsWith("synthetic:")) return "synthetic";
  if (id.startsWith("neuralwatt:")) return "neuralwatt";
  return null;
}

function displayName(provider: ProviderId): string {
  switch (provider) {
    case "anthropic":
      return "Claude";
    case "openai-codex":
      return "Codex";
    case "synthetic":
      return "Synthetic";
    case "neuralwatt":
      return "Neuralwatt";
  }
}

function limitNameFromId(id: string): string {
  const suffix = id.split(":").slice(1).join(":");
  return suffix.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fallbackLimit(
  line: HistoryLine,
  provider: ProviderId,
): NormalizedLimit {
  return {
    kind: "fixed-window",
    provider,
    id: line.id,
    name: limitNameFromId(line.id),
    usedPercent: 0,
    resetsAt: null,
    updatedAt: new Date(line.at),
  };
}

function updateLimit(
  limit: NormalizedLimit,
  line: HistoryLine,
): NormalizedLimit {
  const updatedAt = new Date(line.at);
  if (limit.kind === "fixed-window") {
    const patch: NormalizedLimit = {
      ...limit,
      updatedAt,
      usedPercent:
        limit.capacity != null
          ? Math.max(
              0,
              Math.min(
                100,
                ((limit.capacity - line.remaining) / limit.capacity) * 100,
              ),
            )
          : Math.max(0, Math.min(100, 100 - line.remaining)),
    };
    if (patch.kind === "fixed-window" && limit.capacity != null) {
      patch.used = Math.max(0, limit.capacity - line.remaining);
    }
    return patch;
  }
  if (limit.kind === "refillable") {
    return { ...limit, remaining: line.remaining, updatedAt };
  }
  return { ...limit, remainingAmountMinor: line.remaining, updatedAt };
}

export async function updateProviderCachesFromHistory(
  lines: HistoryLine[],
  now: number,
): Promise<void> {
  const grouped = new Map<ProviderId, HistoryLine[]>();
  for (const line of lines) {
    const provider = providerFromHistoryId(line.id);
    if (!provider) continue;
    const arr = grouped.get(provider) ?? [];
    arr.push(line);
    grouped.set(provider, arr);
  }

  await Promise.all(
    [...grouped.entries()].map(async ([provider, providerLines]) => {
      const cached = await getCachedProvider(provider);
      const limits = cached?.limits ?? [];
      const byId = new Map(limits.map((limit) => [limit.id, limit]));
      const nextLimits = [...limits];

      for (const line of providerLines) {
        const existing = byId.get(line.id);
        const next = existing
          ? updateLimit(existing, line)
          : fallbackLimit(line, provider);
        const index = nextLimits.findIndex((limit) => limit.id === line.id);
        if (index >= 0) nextLimits[index] = next;
        else nextLimits.push(next);
      }

      const snapshot: ProviderSnapshot = {
        provider,
        displayName: cached?.displayName ?? displayName(provider),
        status: cached?.status ?? "unknown",
        statusMessage: cached?.statusMessage,
        limits: nextLimits,
        plan: cached?.plan,
        credits: cached?.credits,
        fetchedAt: new Date(now),
      };
      await writeProviderCache(provider, snapshot);
    }),
  );
}
