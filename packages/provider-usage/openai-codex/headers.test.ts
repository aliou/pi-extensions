import { describe, expect, it } from "vitest";
import { parseOpenAiCodexResponseHeaders } from "./headers";

const now = new Date("2026-07-13T13:22:00Z");

describe("parseOpenAiCodexResponseHeaders", () => {
  it("parses current Codex quota headers case-insensitively", () => {
    const [observation] = parseOpenAiCodexResponseHeaders(
      {
        "X-Codex-Plan-Type": "prolite",
        "X-Codex-Primary-Used-Percent": "12.5",
        "X-Codex-Primary-Window-Minutes": "10080",
        "X-Codex-Primary-Reset-At": "1784553720",
        "X-Codex-Bengalfox-Limit-Name": "GPT-5.3-Codex-Spark",
        "X-Codex-Bengalfox-Primary-Used-Percent": "42",
        "X-Codex-Bengalfox-Primary-Window-Minutes": "300",
        "X-Codex-Credits-Has-Credits": "true",
        "X-Codex-Credits-Balance": "12.34",
      },
      now,
    );

    expect(observation?.status).toEqual({ available: true, plan: "prolite" });
    expect(observation?.account).toEqual({ plan: "prolite" });
    expect(observation?.quotas).toMatchObject([
      {
        id: "primary_window",
        role: "primary",
        amount: { usedPercent: 12.5 },
        period: { durationMs: 604_800_000 },
      },
      {
        id: "gpt-5-3-codex-spark.primary_window",
        role: "model",
        scope: "gpt-5-3-codex-spark",
        amount: { usedPercent: 42 },
      },
      {
        id: "credits",
        role: "budget",
        amount: { remaining: 12.34 },
      },
    ]);
    expect(observation?.quotas[0]?.period).toMatchObject({
      endsAt: new Date("2026-07-20T13:22:00Z"),
    });
  });

  it("keeps valid quota siblings when headers are malformed", () => {
    const [observation] = parseOpenAiCodexResponseHeaders(
      {
        "x-codex-primary-used-percent": "not-a-number",
        "x-codex-secondary-used-percent": "25",
        "x-codex-secondary-reset-after-seconds": "600",
      },
      now,
    );

    expect(observation?.quotas).toHaveLength(1);
    expect(observation?.quotas[0]).toMatchObject({
      id: "secondary_window",
      amount: { usedPercent: 25 },
      period: { endsAt: new Date("2026-07-13T13:32:00Z") },
    });
  });

  it("ignores responses without Codex quota data", () => {
    expect(parseOpenAiCodexResponseHeaders({}, now)).toEqual([]);
  });
});
