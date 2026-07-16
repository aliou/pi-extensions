import { describe, expect, it, vi } from "vitest";
import { getProviderApiKey } from "./auth";

describe("getProviderApiKey", () => {
  it("uses the caller's current provider credential resolver", async () => {
    const getProviderApiKeyFromContext = vi.fn(async () => "token");

    await expect(
      getProviderApiKey("anthropic", {
        getProviderApiKey: getProviderApiKeyFromContext,
      }),
    ).resolves.toBe("token");
    expect(getProviderApiKeyFromContext).toHaveBeenCalledWith("anthropic");
  });

  it("reports a missing credential", async () => {
    await expect(
      getProviderApiKey("anthropic", {
        getProviderApiKey: async () => undefined,
      }),
    ).rejects.toThrow("No credentials for anthropic");
  });
});
