import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type {
  ProviderId,
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";
import { assert, describe, expect, it } from "vitest";
import { ModelBroker } from "./model-broker";
import type {
  ModelPreference,
  ModelRosters,
  ModelUsageReader,
  ProjectionHint,
} from "./types";

const GROUP = "ad:utility:text";
const now = new Date("2026-06-16T00:00:00Z");

describe("ModelBroker", () => {
  it("chooses the first authed model in roster order", () => {
    const broker = brokerFor({
      authed: ["synthetic/a", "neuralwatt/b"],
      rosters: roster([
        { provider: "synthetic", model: "a", thinking: "off" },
        { provider: "neuralwatt", model: "b", thinking: "low" },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference).toEqual({
      provider: "synthetic",
      model: "a",
      thinking: "off",
    });
  });

  it("skips unauthed models without reporting quota skip", () => {
    const broker = brokerFor({
      authed: ["neuralwatt/b"],
      rosters: roster([
        { provider: "synthetic", model: "a", thinking: "off" },
        { provider: "neuralwatt", model: "b", thinking: "low" },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.provider).toBe("neuralwatt");
    expect(choice.skipped).toEqual([]);
  });

  it("skips provider-wide exhausted quotas", () => {
    const broker = brokerFor({
      authed: ["synthetic/a", "neuralwatt/b"],
      usage: usage([
        snapshot("synthetic", [quota("synthetic", "weeklyTokenLimit", 96)]),
      ]),
      rosters: roster([
        { provider: "synthetic", model: "a", thinking: "off" },
        { provider: "neuralwatt", model: "b", thinking: "low" },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.provider).toBe("neuralwatt");
    expect(choice.skipped).toEqual([
      {
        preference: { provider: "synthetic", model: "a", thinking: "off" },
        reason: "quota-blocked",
        detail: "weeklyTokenLimit usage 96%",
      },
    ]);
  });

  it("does not let Synthetic ancillary search quota block model use", () => {
    const broker = brokerFor({
      authed: ["synthetic/a"],
      usage: usage([
        snapshot("synthetic", [
          quota("synthetic", "search.hourly", 100, { role: "ancillary" }),
        ]),
      ]),
      rosters: roster([{ provider: "synthetic", model: "a", thinking: "off" }]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.provider).toBe("synthetic");
  });

  it("blocks only Spark when Spark model quota is exhausted", () => {
    const broker = brokerFor({
      authed: ["openai-codex/gpt-5.3-codex-spark", "openai-codex/gpt-5.5"],
      usage: usage([
        snapshot("openai-codex", [
          quota("openai-codex", "spark.primary_window", 96, {
            role: "model",
            scope: "spark",
            name: "Spark 5h window",
          }),
        ]),
      ]),
      rosters: roster([
        {
          provider: "openai-codex",
          model: "gpt-5.3-codex-spark",
          thinking: "off",
          quotaRefs: [
            { kind: "provider" },
            {
              kind: "model",
              scopes: ["spark", "codex-spark", "gpt-5.3-codex-spark"],
              ids: ["spark.primary_window", "spark.secondary_window"],
            },
          ],
        },
        {
          provider: "openai-codex",
          model: "gpt-5.5",
          thinking: "medium",
          quotaRefs: [
            { kind: "provider" },
            {
              kind: "model",
              scopes: ["gpt-5.5"],
              ids: ["gpt-5.5.primary_window"],
            },
          ],
        },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.model).toBe("gpt-5.5");
    expect(choice.skipped[0]?.detail).toBe("Spark 5h window usage 96%");
  });

  it("blocks only Anthropic Opus when Opus quota is exhausted", () => {
    const broker = brokerFor({
      authed: ["anthropic/claude-opus-4-8", "anthropic/claude-sonnet-4-6"],
      usage: usage([
        snapshot("anthropic", [
          quota("anthropic", "seven_day_opus", 96, {
            role: "model",
            scope: "opus",
            name: "Opus 7 day",
          }),
        ]),
      ]),
      rosters: roster([
        {
          provider: "anthropic",
          model: "claude-opus-4-8",
          thinking: "medium",
          quotaRefs: [
            { kind: "provider" },
            { kind: "model", scopes: ["opus"] },
          ],
        },
        {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          thinking: "medium",
          quotaRefs: [
            { kind: "provider" },
            { kind: "model", scopes: ["sonnet"] },
          ],
        },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.model).toBe("claude-sonnet-4-6");
  });

  it("uses projections when deciding quota availability", () => {
    const weekly = quota("synthetic", "weeklyTokenLimit", 50);
    const broker = brokerFor({
      authed: ["synthetic/a", "neuralwatt/b"],
      usage: usage(
        [snapshot("synthetic", [weekly])],
        new Map([
          [
            "synthetic:weeklyTokenLimit",
            { kind: "projected", usedPercent: 97, horizonMs: 86_400_000 },
          ],
        ]),
      ),
      rosters: roster([
        { provider: "synthetic", model: "a", thinking: "off" },
        { provider: "neuralwatt", model: "b", thinking: "low" },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.provider).toBe("neuralwatt");
    expect(choice.skipped[0]?.detail).toBe("weeklyTokenLimit projected 97%");
  });

  it("blocks quotas projected empty soon", () => {
    const weekly = quota("synthetic", "weeklyTokenLimit", 50);
    const broker = brokerFor({
      authed: ["synthetic/a", "neuralwatt/b"],
      usage: usage(
        [snapshot("synthetic", [weekly])],
        new Map([
          [
            "synthetic:weeklyTokenLimit",
            { kind: "empty", timeToEmptyMs: 30 * 60_000 },
          ],
        ]),
      ),
      rosters: roster([
        { provider: "synthetic", model: "a", thinking: "off" },
        { provider: "neuralwatt", model: "b", thinking: "low" },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.provider).toBe("neuralwatt");
    expect(choice.skipped[0]?.detail).toBe(
      "weeklyTokenLimit projected empty in 30m",
    );
  });

  it("does not block quotas projected empty after 6h", () => {
    const requests = quota("synthetic", "rollingFiveHourLimit", 0, {
      name: "Requests / 5h",
    });
    const broker = brokerFor({
      authed: ["synthetic/a", "neuralwatt/b"],
      usage: usage(
        [snapshot("synthetic", [requests])],
        new Map([
          [
            "synthetic:rollingFiveHourLimit",
            { kind: "empty", timeToEmptyMs: 23 * 60 * 60_000 },
          ],
        ]),
      ),
      rosters: roster([
        { provider: "synthetic", model: "a", thinking: "off" },
        { provider: "neuralwatt", model: "b", thinking: "low" },
      ]),
    });

    const choice = broker.choose(GROUP);

    assert(choice, "choice should exist");
    expect(choice.preference.provider).toBe("synthetic");
    expect(choice.skipped).toEqual([]);
  });
});

function brokerFor(options: {
  authed: string[];
  rosters: ModelRosters;
  usage?: ModelUsageReader;
}): ModelBroker {
  const models = new Map(
    options.authed.map((key) => {
      const [provider, model] = key.split("/");
      assert(provider && model, `invalid model key ${key}`);
      return [key, { provider, id: model } as Model<Api>];
    }),
  );

  return new ModelBroker({
    registry: {
      find(provider: string, modelId: string) {
        return models.get(`${provider}/${modelId}`);
      },
      hasConfiguredAuth(model: Model<Api>) {
        return models.has(`${model.provider}/${model.id}`);
      },
    } as unknown as ModelRegistry,
    usage: options.usage,
    rosters: options.rosters,
  });
}

function roster(preferences: ModelPreference[]): ModelRosters {
  return {
    [GROUP]: preferences,
    "ad:session:read": [],
    "ad:codebase:local": [],
    "ad:codebase:remote": [],
    "ad:review:diff": [],
    "ad:advisor:technical": [],
    "ad:advisor:design": [],
    "ad:vision:inspect": [],
  };
}

function usage(
  snapshots: ProviderUsageSnapshot[],
  projections = new Map<string, ProjectionHint>(),
): ModelUsageReader {
  return {
    state: () => ({ snapshots, projections }),
    snapshot: (provider) =>
      snapshots.find((item) => item.provider === provider),
    quotas: (provider) =>
      snapshots
        .filter((item) => provider == null || item.provider === provider)
        .flatMap((item) => item.quotas),
    projection: (quota) => projections.get(`${quota.provider}:${quota.id}`),
  };
}

function snapshot(
  provider: ProviderId,
  quotas: UsageQuota[],
): ProviderUsageSnapshot {
  return {
    provider,
    displayName: provider,
    fetchedAt: now,
    status: { available: true },
    quotas,
    source: { kind: "api", fetchedAt: now },
  };
}

function quota(
  provider: ProviderId,
  id: string,
  usedPercent: number,
  options: Partial<UsageQuota> = {},
): UsageQuota {
  return {
    provider,
    id,
    name: options.name ?? id,
    role: options.role ?? "primary",
    scope: options.scope,
    updatedAt: now,
    metric: { kind: "percent" },
    amount: { usedPercent },
    period: { kind: "rolling", label: "test" },
    depletion: { kind: "monotonic" },
    replenishment: { kind: "none" },
    state: options.state,
    source: { kind: "api", fetchedAt: now },
  };
}
