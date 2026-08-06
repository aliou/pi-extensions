import type { Api, Model } from "@earendil-works/pi-ai";
import {
  CredentialSynchronizationError,
  type ModelRegistry,
  type ModelRuntime,
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

  it("tolerates a committed credential whose local sync failed", async () => {
    const registry = {
      getRegisteredProviderConfig: vi.fn(() => undefined),
      getApiKeyForProvider: vi.fn(async () => "secret"),
      isUsingOAuth: vi.fn(() => false),
    } as unknown as ModelRegistry;
    const runtime = {
      registerProvider: vi.fn(),
      setRuntimeApiKey: vi.fn(async () => {
        throw new CredentialSynchronizationError(
          "neuralwatt",
          "setRuntimeApiKey",
          { type: "api_key", key: "secret" },
          { cause: new Error("refresh failed") },
        );
      }),
    } as unknown as ModelRuntime;

    const result = await createSubagentModelRuntime(
      registry,
      { provider: "neuralwatt", id: "model" } as Model<Api>,
      async () => runtime,
    );

    expect(result).toBe(runtime);
    expect(runtime.setRuntimeApiKey).toHaveBeenCalledWith(
      "neuralwatt",
      "secret",
    );
  });

  it("rethrows other setRuntimeApiKey failures", async () => {
    const registry = {
      getRegisteredProviderConfig: vi.fn(() => undefined),
      getApiKeyForProvider: vi.fn(async () => "secret"),
      isUsingOAuth: vi.fn(() => false),
    } as unknown as ModelRegistry;
    const runtime = {
      registerProvider: vi.fn(),
      setRuntimeApiKey: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as ModelRuntime;

    await expect(
      createSubagentModelRuntime(
        registry,
        { provider: "custom", id: "model" } as Model<Api>,
        async () => runtime,
      ),
    ).rejects.toThrow("boom");
  });
});
