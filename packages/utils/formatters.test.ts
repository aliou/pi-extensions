import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCurrency,
  formatRelativeTime,
  formatResetTime,
  formatTimeRemaining,
} from "./formatters";

describe("formatter utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatCurrency", () => {
    it("formats USD minor units", () => {
      expect(formatCurrency(1234)).toBe("$12.34");
    });

    it("formats non-USD minor units", () => {
      expect(formatCurrency(1234, "EUR")).toBe("12.34 EUR");
    });
  });

  describe("formatRelativeTime", () => {
    it("formats invalid dates", () => {
      expect(formatRelativeTime("not a date")).toBe("");
    });

    it("formats ISO strings", () => {
      expect(formatRelativeTime("2026-05-02T11:30:00Z")).toBe("30m ago");
    });

    it("formats timestamps", () => {
      expect(formatRelativeTime(Date.parse("2026-05-01T12:00:00Z"))).toBe(
        "1d ago",
      );
    });
  });

  describe("formatTimeRemaining", () => {
    it("formats null dates", () => {
      expect(formatTimeRemaining(null)).toBe("Unknown");
    });

    it("formats recently elapsed dates", () => {
      expect(formatTimeRemaining(new Date("2026-05-02T11:59:00Z"))).toBe(
        "1m ago",
      );
    });

    it("formats long elapsed dates", () => {
      expect(formatTimeRemaining(new Date("2026-04-15T00:00:00Z"))).toBe("now");
    });

    it("formats minutes", () => {
      expect(formatTimeRemaining(new Date("2026-05-02T12:30:00Z"))).toBe("30m");
    });

    it("formats hours and minutes", () => {
      expect(formatTimeRemaining(new Date("2026-05-02T14:05:00Z"))).toBe(
        "2h05m",
      );
    });

    it("formats days and hours", () => {
      expect(formatTimeRemaining(new Date("2026-05-04T15:00:00Z"))).toBe(
        "2d3h",
      );
    });
  });

  describe("formatResetTime", () => {
    it("formats null dates", () => {
      expect(formatResetTime(null)).toBe("Unknown");
    });

    it("formats dates as lowercase display strings", () => {
      expect(formatResetTime(new Date("2026-05-02T12:30:00Z"))).toBe(
        formatResetTime(new Date("2026-05-02T12:30:00Z")).toLowerCase(),
      );
    });
  });
});
