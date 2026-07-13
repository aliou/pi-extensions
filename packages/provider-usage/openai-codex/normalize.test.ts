import { describe, expect, it } from "vitest";
import { normalizeOpenAiCodexUsage } from "./normalize";

const now = new Date("2026-07-13T15:47:41Z");

describe("normalizeOpenAiCodexUsage", () => {
  it("labels windows from their actual duration", () => {
    const snapshot = normalizeOpenAiCodexUsage(
      {
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: {
            used_percent: 45,
            limit_window_seconds: 604_800,
          },
        },
        additional_rate_limits: [
          {
            limit_name: "GPT-5.3-Codex-Spark",
            rate_limit: {
              allowed: true,
              limit_reached: false,
              primary_window: {
                used_percent: 0,
                limit_window_seconds: 604_800,
              },
            },
          },
        ],
      },
      now,
    );

    expect(snapshot.quotas).toMatchObject([
      { id: "primary_window", name: "Weekly" },
      {
        id: "gpt-5-3-codex-spark.primary_window",
        name: "GPT-5.3-Codex-Spark Weekly",
      },
    ]);
  });

  it("includes available reset credits and their expiration dates", () => {
    const snapshot = normalizeOpenAiCodexUsage(
      { rate_limit: { allowed: true, limit_reached: false } },
      now,
      undefined,
      {
        available_count: 2,
        credits: [
          {
            id: "one",
            reset_type: "codex_rate_limits",
            status: "available",
            granted_at: "2026-07-01T00:00:00Z",
            expires_at: "2026-07-26T23:53:44Z",
          },
          {
            id: "expired",
            reset_type: "codex_rate_limits",
            status: "available",
            granted_at: "2026-06-01T00:00:00Z",
            expires_at: "2026-07-01T00:00:00Z",
          },
        ],
      },
    );

    expect(snapshot.quotas).toMatchObject([
      {
        id: "rate_limit_reset_credits",
        amount: { remaining: 2 },
        expirationDates: [new Date("2026-07-26T23:53:44Z")],
      },
    ]);
  });
});
