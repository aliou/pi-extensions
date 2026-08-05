import { describe, expect, it } from "vitest";
import { PROVIDER_COOLDOWN_MS, ProviderCooldown } from "./cooldown";

function clock() {
  let now = 0;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("ProviderCooldown", () => {
  it("excludes a provider for the cooldown window and then restores it", () => {
    const time = clock();
    const cooldown = new ProviderCooldown(PROVIDER_COOLDOWN_MS, time.now);

    expect(cooldown.isCooled("neuralwatt")).toBe(false);
    cooldown.record("neuralwatt");
    expect(cooldown.isCooled("neuralwatt")).toBe(true);
    expect(cooldown.isCooled("synthetic")).toBe(false);

    time.advance(PROVIDER_COOLDOWN_MS - 1);
    expect(cooldown.isCooled("neuralwatt")).toBe(true);

    time.advance(1);
    expect(cooldown.isCooled("neuralwatt")).toBe(false);
  });

  it("clears every entry", () => {
    const cooldown = new ProviderCooldown();
    cooldown.record("neuralwatt");
    cooldown.clear();
    expect(cooldown.isCooled("neuralwatt")).toBe(false);
  });
});
