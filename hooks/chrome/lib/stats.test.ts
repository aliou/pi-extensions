import type { Theme } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildStatsParts } from "./stats";

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
