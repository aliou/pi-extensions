import { getHeader } from "./headers";
import type { HistoryLine } from "./types";

interface SyntheticQuotaWindow {
  limit?: number;
  requests?: number;
  renewsAt?: string;
}

interface SyntheticWeeklyTokenLimit {
  percentRemaining?: number;
  maxCredits?: string;
  remainingCredits?: string;
  nextRegenCredits?: string;
  nextRegenAt?: string;
}

interface SyntheticRollingFiveHourLimit {
  max?: number;
  remaining?: number;
  tickPercent?: number;
  nextTickAt?: string;
  limited?: boolean;
}

interface SyntheticQuotas {
  subscription?: SyntheticQuotaWindow;
  search?: { hourly?: SyntheticQuotaWindow };
  freeToolCalls?: SyntheticQuotaWindow;
  weeklyTokenLimit?: SyntheticWeeklyTokenLimit;
  rollingFiveHourLimit?: SyntheticRollingFiveHourLimit;
}

function parseQuotaHeader(
  headers: Record<string, string> | undefined,
): SyntheticQuotas | undefined {
  const raw = getHeader(headers, "x-synthetic-quotas");
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as SyntheticQuotas;
  } catch (_error) {
    void _error;
    return undefined;
  }
}

function parseDollars(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function pushWindow(
  lines: HistoryLine[],
  id: string,
  window: SyntheticQuotaWindow | undefined,
  at: number,
): void {
  if (!window?.limit || window.limit <= 0) return;
  lines.push({
    id,
    at,
    remaining: Math.max(0, window.limit - (window.requests ?? 0)),
  });
}

export function parseSyntheticHeaders(
  headers: Record<string, string> | undefined,
  at: number,
): HistoryLine[] {
  const quotas = parseQuotaHeader(headers);
  if (!quotas) return [];

  const lines: HistoryLine[] = [];

  if (quotas.rollingFiveHourLimit?.max && quotas.rollingFiveHourLimit.max > 0) {
    lines.push({
      id: "synthetic:rolling-five-hour",
      at,
      remaining:
        quotas.rollingFiveHourLimit.remaining ??
        quotas.rollingFiveHourLimit.max,
    });
  }

  if (quotas.weeklyTokenLimit) {
    const remainingDollars = parseDollars(
      quotas.weeklyTokenLimit.remainingCredits,
    );
    if (remainingDollars != null) {
      lines.push({
        id: "synthetic:weekly-credits",
        at,
        remaining: Math.round(remainingDollars * 100),
      });
    }
  }

  pushWindow(lines, "synthetic:subscription", quotas.subscription, at);
  pushWindow(lines, "synthetic:search-hourly", quotas.search?.hourly, at);
  pushWindow(lines, "synthetic:free-tool-calls", quotas.freeToolCalls, at);

  return lines;
}
