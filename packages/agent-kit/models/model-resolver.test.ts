import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { pickModel, resolveModel } from "./model-resolver";
import type { SubagentModelPreference, SubagentResolvedModel } from "./types";

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

  it("falls back to uniform selection when all weights are zero", () => {
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
    expect(pickModel(registry, prefs)?.preference.model).toBe("b");
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
