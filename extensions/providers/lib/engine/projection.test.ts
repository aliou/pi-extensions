import { describe, expect, it } from "vitest";
import {
  getCurrentMonthPacePercent,
  getCurrentMonthProjectedPercent,
} from "./projection";

describe("current month projection", () => {
  it("uses the actual current month duration", () => {
    const now = new Date(2024, 1, 15, 0, 0, 0, 0);
    const start = new Date(2024, 1, 1, 0, 0, 0, 0);
    const end = new Date(2024, 2, 1, 0, 0, 0, 0);
    const expected =
      ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) *
      100;

    expect(getCurrentMonthPacePercent(now)).toBe(expected);
  });

  it("projects usage to the end of the current month", () => {
    const now = new Date(2024, 1, 15, 0, 0, 0, 0);
    const pace = getCurrentMonthPacePercent(now);

    expect(getCurrentMonthProjectedPercent(10, now)).toBe((10 / pace) * 100);
  });
});
