import type { Theme } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildMinimalStatsParts, buildStatsParts } from "./stats";

const theme = {
  fg: (_color: string, text: string) => text,
} as unknown as Theme;

const usage = {
  totalCost: 0.1234,
  branchCost: 0.1234,
};

const contextUsage = {
  window: 272_000,
  percent: 10,
  display: "10.0% 27.2k/272k",
};

describe("buildStatsParts", () => {
  it("places TPS before cost", () => {
    expect(buildStatsParts(theme, usage, contextUsage, 42.25)).toEqual([
      "42.3 tps $0.123 10.0% 27.2k/272k",
    ]);
  });

  it("omits TPS when latest telemetry is null", () => {
    expect(buildStatsParts(theme, usage, contextUsage, null)).toEqual([
      "$0.123 10.0% 27.2k/272k",
    ]);
  });

  it("omits TPS before telemetry arrives", () => {
    expect(buildStatsParts(theme, usage, contextUsage)).toEqual([
      "$0.123 10.0% 27.2k/272k",
    ]);
  });
});

describe("buildMinimalStatsParts", () => {
  // Mirrors the production crash inputs (terminal width 40): full stats line
  // "142.0 tps $0.009 ($0.140) 5.0% 10.0k/200k" is 41 wide and overflowed the
  // viewport. Minimal mode must drop tps and the cumulative-cost parenthetical.
  const splitUsage = {
    totalCost: 0.14,
    branchCost: 0.009,
  };

  const splitContextUsage = {
    window: 200_000,
    percent: 5,
    display: "5.0% 10.0k/200k",
  };

  it("drops TPS and the cumulative-cost parenthetical", () => {
    expect(
      buildMinimalStatsParts(theme, splitUsage, splitContextUsage),
    ).toEqual(["$0.009 5.0% 10.0k/200k"]);
  });

  it("is narrower than the full stats line", () => {
    const full =
      buildStatsParts(theme, splitUsage, splitContextUsage, 142.0)[0]?.length ??
      0;
    const minimal =
      buildMinimalStatsParts(theme, splitUsage, splitContextUsage)[0]?.length ??
      0;
    expect(minimal).toBeLessThan(full);
  });

  it("wraps the whole line in error color above the error threshold", () => {
    const errorTheme = {
      fg: (color: string, text: string) =>
        color === "error" ? `[err]${text}` : text,
    } as unknown as Theme;
    const overError = {
      ...splitContextUsage,
      percent: 60,
      display: "60.0% 10.0k/200k",
    };
    expect(buildMinimalStatsParts(errorTheme, splitUsage, overError)).toEqual([
      "[err]$0.009 60.0% 10.0k/200k",
    ]);
  });
});
