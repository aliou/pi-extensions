import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { ProviderCooldown } from "./cooldown";
import {
  pickModel,
  rankModels,
  rankPreferences,
  resolveModel,
} from "./model-resolver";
import type { SubagentModelPreference, SubagentResolvedModel } from "./types";

const noCooldown = { isCooled: () => false };

function mockRegistry(opts: {
  authed: Set<string>;
  known: Set<string>;
}): ModelRegistry {
  const known = opts.known;
  const authed = opts.authed;
  const model = (provider: string, model: string) =>
    ({ id: model, provider }) as never;
  return {
    find: (provider: string, modelId: string) =>
      known.has(`${provider}/${modelId}`)
        ? model(provider, modelId)
        : undefined,
    hasConfiguredAuth: (m: { provider: string; id: string }) =>
      authed.has(`${m.provider}/${m.id}`),
  } as unknown as ModelRegistry;
}

const PREFS: SubagentModelPreference[] = [
  { provider: "neuralwatt", model: "a", thinking: "medium", weight: 3 },
  { provider: "neuralwatt", model: "b", thinking: "medium", weight: 1 },
  { provider: "neuralwatt", model: "c", thinking: "medium", weight: 1 },
];

describe("pickModel", () => {
  it("returns null when no preferences are authed", () => {
    const registry = mockRegistry({
      authed: new Set(),
      known: new Set(["neuralwatt/a"]),
    });
    expect(pickModel(registry, PREFS)).toBeNull();
  });

  it("skips unknown and unauthed models, reports them, and picks among authed", () => {
    const registry = mockRegistry({
      known: new Set(["neuralwatt/a", "neuralwatt/b"]),
      authed: new Set(["neuralwatt/a", "neuralwatt/b"]),
    });
    const prefs: SubagentModelPreference[] = [
      {
        provider: "neuralwatt",
        model: "missing",
        thinking: "medium",
        weight: 1,
      },
      { provider: "neuralwatt", model: "a", thinking: "medium", weight: 1 },
      { provider: "neuralwatt", model: "b", thinking: "medium", weight: 1 },
    ];
    const choice = pickModel(registry, prefs);
    expect(choice).not.toBeNull();
    if (!choice) return;
    expect(choice.preference.model).toMatch(/^(a|b)$/);
    expect(choice.skipped.map((s) => s.reason)).toEqual(["unknown-model"]);
    expect(choice.skipped.map((s) => s.preference.model)).toEqual(["missing"]);
  });

  it("distributes selection by weight across many draws", () => {
    const registry = mockRegistry({
      known: new Set(["neuralwatt/a", "neuralwatt/b", "neuralwatt/c"]),
      authed: new Set(["neuralwatt/a", "neuralwatt/b", "neuralwatt/c"]),
    });
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const draws = 30_000;
    for (let i = 0; i < draws; i++) {
      const choice = pickModel(registry, PREFS);
      if (!choice) throw new Error("expected a choice");
      const key = choice.preference.model;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    // weights a:b:c = 3:1:1 -> a ~60%, b ~20%, c ~20%
    const ratioA = (counts.a ?? 0) / draws;
    const ratioB = (counts.b ?? 0) / draws;
    expect(ratioA).toBeGreaterThan(0.55);
    expect(ratioA).toBeLessThan(0.65);
    expect(ratioB).toBeGreaterThan(0.15);
    expect(ratioB).toBeLessThan(0.25);
  });

  it("takes zero-weight entries in roster order, never at random", () => {
    const registry = mockRegistry({
      known: new Set(["neuralwatt/a", "neuralwatt/b"]),
      authed: new Set(["neuralwatt/a", "neuralwatt/b"]),
    });
    const prefs: SubagentModelPreference[] = [
      { provider: "neuralwatt", model: "a", thinking: "medium", weight: 0 },
      { provider: "neuralwatt", model: "b", thinking: "medium", weight: 0 },
    ];
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    expect(pickModel(registry, prefs)?.preference.model).toBe("a");
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(pickModel(registry, prefs)?.preference.model).toBe("a");
    vi.restoreAllMocks();
  });

  it("does not randomly bleed onto a zero-weight fallback", () => {
    const registry = mockRegistry({
      known: new Set(["anthropic/claude-fable-5", "anthropic/claude-opus-4-8"]),
      authed: new Set([
        "anthropic/claude-fable-5",
        "anthropic/claude-opus-4-8",
      ]),
    });
    const prefs: SubagentModelPreference[] = [
      {
        provider: "anthropic",
        model: "claude-fable-5",
        thinking: "high",
        weight: 1,
      },
      {
        provider: "anthropic",
        model: "claude-opus-4-8",
        thinking: "xhigh",
        weight: 0,
      },
    ];

    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(pickModel(registry, prefs)?.preference.model).toBe("claude-fable-5");
    vi.restoreAllMocks();
  });

  it("selects a zero-weight fallback when the primary is unusable", () => {
    const registry = mockRegistry({
      known: new Set(["anthropic/claude-fable-5", "anthropic/claude-opus-4-8"]),
      authed: new Set(["anthropic/claude-opus-4-8"]),
    });
    const prefs: SubagentModelPreference[] = [
      {
        provider: "anthropic",
        model: "claude-fable-5",
        thinking: "high",
        weight: 1,
      },
      {
        provider: "anthropic",
        model: "claude-opus-4-8",
        thinking: "xhigh",
        weight: 0,
      },
    ];

    const choice = pickModel(registry, prefs);

    expect(choice?.preference.model).toBe("claude-opus-4-8");
    expect(choice?.skipped).toEqual([
      {
        preference: {
          provider: "anthropic",
          model: "claude-fable-5",
          thinking: "high",
        },
        reason: "unauthed",
      },
    ]);
  });
});

describe("resolveModel", () => {
  it("prefers the pinned model when still authed", () => {
    const registry = mockRegistry({
      known: new Set(["neuralwatt/a", "neuralwatt/b"]),
      authed: new Set(["neuralwatt/a", "neuralwatt/b"]),
    });
    const pinned: SubagentResolvedModel = {
      provider: "neuralwatt",
      model: "b",
      thinking: "medium",
    };
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(resolveModel(registry, PREFS, pinned)?.preference.model).toBe("b");
    vi.restoreAllMocks();
  });

  it("falls back to pickModel when the pinned model is no longer authed", () => {
    const registry = mockRegistry({
      known: new Set(["neuralwatt/a", "neuralwatt/b"]),
      authed: new Set(["neuralwatt/a"]),
    });
    const pinned: SubagentResolvedModel = {
      provider: "neuralwatt",
      model: "b",
      thinking: "medium",
    };
    expect(resolveModel(registry, PREFS, pinned)?.preference.model).toBe("a");
  });
});

describe("rankPreferences", () => {
  const pref = (model: string, weight: number): SubagentModelPreference => ({
    provider: "p",
    model,
    thinking: "off",
    weight,
  });

  it("ranks positive weights proportionally in first position", () => {
    const entries = [pref("heavy", 2), pref("light", 1)];
    const draws = 20_000;
    let heavyFirst = 0;
    for (let i = 0; i < draws; i++) {
      if (rankPreferences(entries)[0]?.model === "heavy") heavyFirst++;
    }
    // 2:1 weights -> heavy leads ~2/3 of the time.
    expect(heavyFirst / draws).toBeGreaterThan(0.63);
    expect(heavyFirst / draws).toBeLessThan(0.7);
  });

  it("returns every entry exactly once", () => {
    const entries = [pref("a", 1), pref("b", 2), pref("c", 0), pref("d", 0)];
    const ranked = rankPreferences(entries);
    expect(ranked).toHaveLength(4);
    expect(new Set(ranked.map((e) => e.model)).size).toBe(4);
  });

  it("places zero-weight entries last, in roster order", () => {
    const entries = [
      pref("zero-first", 0),
      pref("hot", 1),
      pref("zero-second", 0),
    ];
    for (let i = 0; i < 200; i++) {
      expect(rankPreferences(entries).map((e) => e.model)).toEqual([
        "hot",
        "zero-first",
        "zero-second",
      ]);
    }
  });

  it("treats negative weights as fallbacks rather than inverting the order", () => {
    const entries = [pref("negative", -5), pref("hot", 1)];
    expect(rankPreferences(entries).map((e) => e.model)).toEqual([
      "hot",
      "negative",
    ]);
  });
});

describe("rankModels", () => {
  const ROSTER: SubagentModelPreference[] = [
    { provider: "neuralwatt", model: "gemma", thinking: "off", weight: 1 },
    { provider: "synthetic", model: "flash", thinking: "off", weight: 1 },
    { provider: "zai", model: "turbo", thinking: "off", weight: 0 },
    { provider: "openrouter", model: "gemma-it", thinking: "off", weight: 0 },
  ];
  const allKnown = () =>
    mockRegistry({
      known: new Set([
        "neuralwatt/gemma",
        "synthetic/flash",
        "zai/turbo",
        "openrouter/gemma-it",
      ]),
      authed: new Set([
        "neuralwatt/gemma",
        "synthetic/flash",
        "zai/turbo",
        "openrouter/gemma-it",
      ]),
    });

  it("returns the whole usable roster as an ordered failover chain", () => {
    const ranking = rankModels(allKnown(), ROSTER, noCooldown);
    expect(ranking.candidates).toHaveLength(4);
    // Both weighted entries outrank both fallbacks, whatever the draw.
    const leading = ranking.candidates
      .slice(0, 2)
      .map((c) => c.preference.provider)
      .sort();
    expect(leading).toEqual(["neuralwatt", "synthetic"]);
    expect(
      ranking.candidates.slice(2).map((c) => c.preference.provider),
    ).toEqual(["zai", "openrouter"]);
  });

  it("excludes cooled providers while a hot candidate remains", () => {
    const cooldown = new ProviderCooldown();
    cooldown.record("neuralwatt");
    const ranking = rankModels(allKnown(), ROSTER, {
      isCooled: (provider) => cooldown.isCooled(provider),
    });
    expect(ranking.candidates.map((c) => c.preference.provider)).not.toContain(
      "neuralwatt",
    );
    expect(ranking.skipped).toContainEqual({
      preference: { provider: "neuralwatt", model: "gemma", thinking: "off" },
      reason: "recently-failed",
    });
  });

  it("ignores cooldowns when every usable candidate is cooled", () => {
    const ranking = rankModels(allKnown(), ROSTER, { isCooled: () => true });
    expect(ranking.candidates).toHaveLength(4);
    expect(ranking.skipped).toEqual([]);
  });

  it("reports unusable entries and keeps the rest ranked", () => {
    const registry = mockRegistry({
      known: new Set(["synthetic/flash", "zai/turbo"]),
      authed: new Set(["synthetic/flash"]),
    });
    const ranking = rankModels(registry, ROSTER, noCooldown);
    expect(ranking.candidates.map((c) => c.preference.provider)).toEqual([
      "synthetic",
    ]);
    expect(ranking.skipped.map((s) => s.reason).sort()).toEqual([
      "unauthed",
      "unknown-model",
      "unknown-model",
    ]);
  });

  it("returns no candidates when nothing in the roster is usable", () => {
    const registry = mockRegistry({ known: new Set(), authed: new Set() });
    expect(rankModels(registry, ROSTER, noCooldown).candidates).toEqual([]);
  });
});
