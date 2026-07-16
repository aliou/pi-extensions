import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ModelRegistry,
  ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { createSubagentModelRuntime } from "./model-runtime";

describe("createSubagentModelRuntime", () => {
  it("inherits the selected provider registration and resolved API key", async () => {
    const providerConfig = { baseUrl: "https://example.test" };
    const registry = {
      getRegisteredProviderConfig: vi.fn(() => providerConfig),
      getApiKeyForProvider: vi.fn(async () => "secret"),
      isUsingOAuth: vi.fn(() => false),
    } as unknown as ModelRegistry;
    const runtime = {
      registerProvider: vi.fn(),
      setRuntimeApiKey: vi.fn(async () => undefined),
    } as unknown as ModelRuntime;
    const createRuntime = vi.fn(async () => runtime);
    const model = {
      provider: "custom",
      id: "model",
    } as Model<Api>;

    await createSubagentModelRuntime(registry, model, createRuntime);

    expect(runtime.registerProvider).toHaveBeenCalledWith(
      "custom",
      providerConfig,
    );
    expect(runtime.setRuntimeApiKey).toHaveBeenCalledWith("custom", "secret");
  });

  it("keeps runtime defaults when the parent has no override or key", async () => {
    const registry = {
      getRegisteredProviderConfig: vi.fn(() => undefined),
      getApiKeyForProvider: vi.fn(async () => undefined),
      isUsingOAuth: vi.fn(() => false),
    } as unknown as ModelRegistry;
    const runtime = {
      registerProvider: vi.fn(),
      setRuntimeApiKey: vi.fn(async () => undefined),
    } as unknown as ModelRuntime;

    await createSubagentModelRuntime(
      registry,
      { provider: "anthropic", id: "model" } as Model<Api>,
      async () => runtime,
    );

    expect(runtime.registerProvider).not.toHaveBeenCalled();
    expect(runtime.setRuntimeApiKey).not.toHaveBeenCalled();
  });

  it("preserves OAuth credentials for OAuth-backed providers", async () => {
    const registry = {
      getRegisteredProviderConfig: vi.fn(() => undefined),
      getApiKeyForProvider: vi.fn(async () => "oauth-access-token"),
      isUsingOAuth: vi.fn(() => true),
    } as unknown as ModelRegistry;
    const runtime = {
      registerProvider: vi.fn(),
      setRuntimeApiKey: vi.fn(async () => undefined),
    } as unknown as ModelRuntime;

    await createSubagentModelRuntime(
      registry,
      { provider: "anthropic", id: "model" } as Model<Api>,
      async () => runtime,
    );

    expect(runtime.setRuntimeApiKey).not.toHaveBeenCalled();
  });
});
