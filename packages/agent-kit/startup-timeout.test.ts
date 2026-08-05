import { describe, expect, it, vi } from "vitest";
import {
  createStartupBudget,
  isStartupTimeoutError,
  startupTimeoutError,
  withStartupTimeout,
} from "./startup-timeout";

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

  it("skips the race entirely for a non-finite window", async () => {
    vi.useFakeTimers();
    try {
      const promise = withStartupTimeout(
        async () => "done",
        "Scout",
        Number.POSITIVE_INFINITY,
      );
      await vi.advanceTimersByTimeAsync(600_000);
      await expect(promise).resolves.toBe("done");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createStartupBudget", () => {
  it("caps each attempt and stops handing out windows when spent", () => {
    let now = 0;
    const budget = createStartupBudget({
      totalMs: 60,
      attemptMs: 25,
      now: () => now,
    });

    expect(budget.nextWindow()).toBe(25);
    now = 50;
    expect(budget.nextWindow()).toBe(10);
    now = 60;
    expect(budget.nextWindow()).toBe(0);
  });

  it("disarms permanently once an attempt streams output", () => {
    let now = 0;
    const budget = createStartupBudget({
      totalMs: 60,
      attemptMs: 25,
      now: () => now,
    });

    expect(budget.started).toBe(false);
    budget.markStarted();
    now = 10_000;

    expect(budget.started).toBe(true);
    expect(budget.nextWindow()).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("startupTimeoutError", () => {
  it("names the label and the window", () => {
    const message = startupTimeoutError("Scout").message;
    expect(message).toContain("Scout");
    expect(message).toContain("60s");
  });

  it("is recognizable so the failover loop can treat a stall as a provider failure", () => {
    expect(isStartupTimeoutError(startupTimeoutError("Scout"))).toBe(true);
    expect(isStartupTimeoutError(new Error("did not start"))).toBe(false);
  });
});
