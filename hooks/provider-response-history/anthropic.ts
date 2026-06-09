import { getHeader, parsePercent } from "./headers";
import type { HistoryLine } from "./types";

const HEADER_PREFIX = "anthropic-ratelimit-unified-";
const HEADER_SUFFIX = "-utilization";

const CLAIM_IDS: Record<string, string> = {
  "5h": "anthropic:five-hour",
  "7d": "anthropic:seven-day",
  "7d-opus": "anthropic:seven-day-opus",
  "7d-sonnet": "anthropic:seven-day-sonnet",
  "7d_opus": "anthropic:seven-day-opus",
  "7d_sonnet": "anthropic:seven-day-sonnet",
};

function sanitizeClaim(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function claimId(claim: string): string {
  return (
    CLAIM_IDS[claim] ??
    CLAIM_IDS[claim.replace(/-/g, "_")] ??
    `anthropic:${sanitizeClaim(claim)}`
  );
}

export function isAnthropicOverageInUse(
  headers: Record<string, string> | undefined,
): boolean {
  if (!headers) return false;
  const explicit = getHeader(
    headers,
    "anthropic-ratelimit-unified-overage-in-use",
  )?.toLowerCase();
  if (explicit === "true") return true;

  return (
    getHeader(headers, "anthropic-ratelimit-unified-representative-claim")
      ?.toLowerCase()
      .replace(/_/g, "-") === "overage"
  );
}

export function parseAnthropicHeaders(
  headers: Record<string, string> | undefined,
  at: number,
): HistoryLine[] {
  if (!headers) return [];

  const byId = new Map<string, HistoryLine>();

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (!lower.startsWith(HEADER_PREFIX) || !lower.endsWith(HEADER_SUFFIX)) {
      continue;
    }

    const claim = lower.slice(
      HEADER_PREFIX.length,
      lower.length - HEADER_SUFFIX.length,
    );
    const utilization = parsePercent(value, true);
    if (utilization == null) continue;

    byId.set(claimId(claim), {
      id: claimId(claim),
      at,
      remaining: 100 - utilization,
    });
  }

  return [...byId.values()];
}
