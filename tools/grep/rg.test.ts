import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { runRg } from "./rg";

function fakeProcess() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    kill: vi.fn(() => {
      queueMicrotask(() => child.emit("close", null));
      return true;
    }),
  });
  return child;
}

describe("runRg", () => {
  it("stops reading once the global match limit is reached", async () => {
    const child = fakeProcess();
    const spawnProcess = vi.fn(() => child) as unknown as NonNullable<
      Parameters<typeof runRg>[4]
    >;
    const promise = runRg([], "/repo", undefined, 2, spawnProcess);

    child.stdout.emit(
      "data",
      [
        JSON.stringify({
          type: "match",
          data: { path: { text: "/repo/a.ts" }, line_number: 1 },
        }),
        JSON.stringify({
          type: "match",
          data: { path: { text: "/repo/b.ts" }, line_number: 2 },
        }),
      ].join("\n"),
    );
    child.emit("close", null);

    const result = await promise;

    expect(result.matches).toHaveLength(2);
    expect(result.matchLimitReached).toBe(true);
    expect(result.killed).toBe(true);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("bounds raw ripgrep output before it can be accumulated", async () => {
    const child = fakeProcess();
    const spawnProcess = vi.fn(() => child) as unknown as NonNullable<
      Parameters<typeof runRg>[4]
    >;
    const promise = runRg([], "/repo", undefined, 100, spawnProcess);

    child.stdout.emit("data", "x".repeat(1024 * 1024 + 1));

    const result = await promise;

    expect(result.outputTruncated).toBe(true);
    expect(result.killed).toBe(true);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
});
