import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { createPiTestHarness } from "@harness/test-utils/pi-test-harness";
import { describe, expect, it, vi } from "vitest";
import setupCompactFastCommand from "./index";

function createMockModel(provider: string, id: string): Model<Api> {
  return {
    api: "openai-completions",
    baseUrl: "",
    contextWindow: 128_000,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    id,
    input: ["text"],
    maxTokens: 4096,
    name: id,
    provider,
    reasoning: false,
  };
}

function createMockModelRegistry(
  available: { provider: string; id: string }[],
): ModelRegistry {
  const models = new Map(
    available.map((candidate) => [
      `${candidate.provider}/${candidate.id}`,
      createMockModel(candidate.provider, candidate.id),
    ]),
  );

  return {
    find: (provider: string, id: string) =>
      models.get(`${provider}/${id}`) ?? undefined,
    hasConfiguredAuth: () => true,
  } as unknown as ModelRegistry;
}

interface CompactCallbacks {
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

function createCompactSpy(): {
  compact: () => void;
  callbacks: CompactCallbacks;
} {
  const callbacks: CompactCallbacks = {};
  const compact = vi.fn(
    (opts: { onComplete?: () => void; onError?: (error: Error) => void }) => {
      callbacks.onComplete = opts.onComplete;
      callbacks.onError = opts.onError;
    },
  );
  return { compact: compact as unknown as () => void, callbacks };
}

describe("/compact:fast command", () => {
  it("registers the command", async () => {
    const pi = await createPiTestHarness(setupCompactFastCommand);
    expect(pi).toHaveRegisteredCommand("compact:fast");
  });

  it("notifies error when no fast model is available", async () => {
    const notify = vi.fn();
    const pi = await createPiTestHarness(setupCompactFastCommand, {
      context: {
        compact: vi.fn() as unknown as () => void,
        modelRegistry: createMockModelRegistry([]),
        ui: { notify },
      },
    });
    pi.runtime.setModel = vi.fn();

    await pi.command("compact:fast").execute("");

    expect(notify).toHaveBeenCalledWith(
      "No fast compaction model available",
      "error",
    );
    expect(pi.runtime.setModel).not.toHaveBeenCalled();
  });

  it("switches to the first available fast model, compacts, and reverts on completion", async () => {
    const notify = vi.fn();
    const originalModel = createMockModel("anthropic", "claude-sonnet-4");
    const fastModel = createMockModel("neuralwatt", "kimi-k2.6-fast");
    const { compact, callbacks } = createCompactSpy();

    const pi = await createPiTestHarness(setupCompactFastCommand, {
      context: {
        compact,
        model: originalModel,
        modelRegistry: createMockModelRegistry([
          { provider: "neuralwatt", id: "kimi-k2.6-fast" },
        ]),
        ui: { notify },
      },
    });
    pi.runtime.setModel = vi.fn(async () => true);

    const ctx = await pi.command("compact:fast").execute("");

    expect(pi.runtime.setModel).toHaveBeenCalledWith(fastModel);
    expect(compact).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      "Compacting with neuralwatt/kimi-k2.6-fast",
      "info",
    );

    ctx.model = fastModel;
    callbacks.onComplete?.();

    await vi.waitFor(() =>
      expect(pi.runtime.setModel).toHaveBeenCalledTimes(2),
    );
    expect(pi.runtime.setModel).toHaveBeenLastCalledWith(originalModel);
    expect(notify).toHaveBeenLastCalledWith(
      "Compaction complete: reverted to anthropic/claude-sonnet-4",
      "info",
    );
  });

  it("falls back to the next candidate when the first is unavailable", async () => {
    const notify = vi.fn();
    const originalModel = createMockModel("anthropic", "claude-sonnet-4");
    const fastModel = createMockModel("synthetic", "syn:small:text");

    const pi = await createPiTestHarness(setupCompactFastCommand, {
      context: {
        compact: vi.fn() as unknown as () => void,
        model: originalModel,
        modelRegistry: {
          find: (provider: string, id: string) => {
            if (provider === "synthetic" && id === "syn:small:text") {
              return createMockModel(provider, id);
            }
            return undefined;
          },
          hasConfiguredAuth: () => true,
        } as unknown as ModelRegistry,
        ui: { notify },
      },
    });
    pi.runtime.setModel = vi.fn(async () => true);

    await pi.command("compact:fast").execute("");

    expect(pi.runtime.setModel).toHaveBeenCalledWith(fastModel);
  });

  it("reverts to the original model after a compaction error", async () => {
    const notify = vi.fn();
    const originalModel = createMockModel("openai", "gpt-5");
    const fastModel = createMockModel("neuralwatt", "kimi-k2.6-fast");
    const { compact, callbacks } = createCompactSpy();

    const pi = await createPiTestHarness(setupCompactFastCommand, {
      context: {
        compact,
        model: originalModel,
        modelRegistry: createMockModelRegistry([
          { provider: "neuralwatt", id: "kimi-k2.6-fast" },
        ]),
        ui: { notify },
      },
    });
    pi.runtime.setModel = vi.fn(async () => true);

    const ctx = await pi.command("compact:fast").execute("");

    ctx.model = fastModel;
    callbacks.onError?.(new Error("summarizer failed"));

    await vi.waitFor(() =>
      expect(pi.runtime.setModel).toHaveBeenCalledTimes(2),
    );
    expect(pi.runtime.setModel).toHaveBeenLastCalledWith(originalModel);
    expect(notify).toHaveBeenCalledWith(
      "Compaction failed: summarizer failed",
      "error",
    );
    expect(notify).toHaveBeenLastCalledWith(
      "Compaction error: reverted to openai/gpt-5",
      "info",
    );
  });

  it("stays on the new model when the user changes model during compaction", async () => {
    const notify = vi.fn();
    const originalModel = createMockModel("anthropic", "claude-sonnet-4");
    const changedModel = createMockModel("openai-codex", "gpt-5.6-luna");
    const { compact, callbacks } = createCompactSpy();

    const pi = await createPiTestHarness(setupCompactFastCommand, {
      context: {
        compact,
        model: originalModel,
        modelRegistry: createMockModelRegistry([
          { provider: "neuralwatt", id: "kimi-k2.6-fast" },
        ]),
        ui: { notify },
      },
    });
    pi.runtime.setModel = vi.fn(async () => true);

    const ctx = await pi.command("compact:fast").execute("");

    ctx.model = changedModel;
    callbacks.onComplete?.();

    await vi.waitFor(() =>
      expect(notify).toHaveBeenLastCalledWith(
        "Compaction complete: model changed to openai-codex/gpt-5.6-luna, staying",
        "info",
      ),
    );
    expect(pi.runtime.setModel).toHaveBeenCalledTimes(1);
  });

  it("stays on the fast model when there is no previous model", async () => {
    const notify = vi.fn();
    const fastModel = createMockModel("neuralwatt", "kimi-k2.6-fast");
    const { compact, callbacks } = createCompactSpy();

    const pi = await createPiTestHarness(setupCompactFastCommand, {
      context: {
        compact,
        model: undefined,
        modelRegistry: createMockModelRegistry([
          { provider: "neuralwatt", id: "kimi-k2.6-fast" },
        ]),
        ui: { notify },
      },
    });
    pi.runtime.setModel = vi.fn(async () => true);

    const ctx = await pi.command("compact:fast").execute("");

    ctx.model = fastModel;
    callbacks.onComplete?.();

    await vi.waitFor(() =>
      expect(notify).toHaveBeenLastCalledWith(
        "Compaction complete: staying on neuralwatt/kimi-k2.6-fast (no previous model)",
        "info",
      ),
    );
    expect(pi.runtime.setModel).toHaveBeenCalledTimes(1);
  });
});
