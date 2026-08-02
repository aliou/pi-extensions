import { describe, expect, it, vi } from "vitest";
import { startupTimeoutError, withStartupTimeout } from "./startup-timeout";

describe("withStartupTimeout", () => {
  it("returns the work result when it signals start and completes", async () => {
    const result = await withStartupTimeout(async (started) => {
      started();
      return "done";
    }, "Scout");
    expect(result).toBe("done");
  });

  it("rejects with a startup error when work never signals start", async () => {
    vi.useFakeTimers();
    try {
      const promise = withStartupTimeout(
        // Never resolves, never disarms.
        () => new Promise<string>(() => {}),
        "Scout",
      );
      const assertion = expect(promise).rejects.toThrow(
        /Scout subagent did not start within 60s/,
      );
      await vi.advanceTimersByTimeAsync(60_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not time out once start has been signaled", async () => {
    vi.useFakeTimers();
    try {
      let resolveWork!: (value: string) => void;
      const promise = withStartupTimeout<string>((started) => {
        return new Promise((resolve) => {
          started();
          resolveWork = resolve;
        });
      }, "Scout");
      // Well past the window — no rejection because start was signaled.
      await vi.advanceTimersByTimeAsync(120_000);
      resolveWork("done");
      await expect(promise).resolves.toBe("done");
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates the work error when work rejects before the timeout", async () => {
    await expect(
      withStartupTimeout(async () => {
        throw new Error("boom");
      }, "Scout"),
    ).rejects.toThrow("boom");
  });
});

describe("startupTimeoutError", () => {
  it("names the label and the window", () => {
    const message = startupTimeoutError("Scout").message;
    expect(message).toContain("Scout");
    expect(message).toContain("60s");
  });
});
