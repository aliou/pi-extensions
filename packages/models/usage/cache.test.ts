import type {
  ProviderUsageObservation,
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";
import { describe, expect, it } from "vitest";
import { mergeUsageObservation } from "./cache";

const apiTime = new Date("2026-07-13T12:00:00Z");
const headerTime = new Date("2026-07-13T13:00:00Z");

describe("mergeUsageObservation", () => {
  it("replaces observed quotas while preserving API account data and siblings", () => {
    const cachedPrimary = {
      ...quota("primary_window", 10),
      amount: { usedPercent: 10, capacity: 100 },
      period: {
        kind: "rolling" as const,
        label: "7 day",
        durationMs: 604_800_000,
        endsAt: apiTime,
      },
      replenishment: { kind: "full-reset" as const, at: apiTime },
      state: { limited: false },
      raw: { from: "api" },
    };
    const headerPrimary = {
      ...quota("primary_window", 30, "response-header"),
      period: { kind: "rolling" as const, label: "window" },
      replenishment: { kind: "full-reset" as const, at: null },
    };
    const merged = mergeUsageObservation(
      [snapshot([cachedPrimary, quota("secondary_window", 20)])],
      observation([headerPrimary]),
    );

    expect(merged[0]).toMatchObject({
      fetchedAt: headerTime,
      source: { kind: "response-header" },
      status: { available: true, plan: "prolite" },
      account: { id: "account", email: "user@example.com", plan: "prolite" },
    });
    expect(merged[0]?.quotas).toMatchObject([
      {
        id: "primary_window",
        amount: { usedPercent: 30, capacity: 100 },
        period: { durationMs: 604_800_000, endsAt: apiTime },
        replenishment: { at: apiTime },
        state: { limited: false },
        raw: { from: "api" },
      },
      { id: "secondary_window", amount: { usedPercent: 20 } },
    ]);
  });

  it("does not seed the dashboard cache from partial response headers", () => {
    const merged = mergeUsageObservation(
      [],
      observation([quota("primary_window", 30, "response-header")]),
    );

    expect(merged).toEqual([]);
  });
});

function snapshot(quotas: UsageQuota[]): ProviderUsageSnapshot {
  return {
    provider: "openai-codex",
    displayName: "OpenAI Codex",
    fetchedAt: apiTime,
    status: { available: true },
    account: { id: "account", email: "user@example.com" },
    quotas,
    source: { kind: "api", fetchedAt: apiTime },
  };
}

function observation(quotas: UsageQuota[]): ProviderUsageObservation {
  return {
    provider: "openai-codex",
    displayName: "OpenAI Codex",
    observedAt: headerTime,
    status: { plan: "prolite" },
    account: { plan: "prolite" },
    quotas,
    source: { kind: "response-header", fetchedAt: headerTime },
  };
}

function quota(
  id: string,
  usedPercent: number,
  sourceKind: "api" | "response-header" = "api",
): UsageQuota {
  return {
    provider: "openai-codex",
    id,
    name: id,
    role: "primary",
    updatedAt: sourceKind === "api" ? apiTime : headerTime,
    metric: { kind: "percent" },
    amount: { usedPercent },
    period: { kind: "rolling", label: "window" },
    depletion: { kind: "monotonic" },
    replenishment: { kind: "none" },
    source: {
      kind: sourceKind,
      fetchedAt: sourceKind === "api" ? apiTime : headerTime,
    },
  };
}
