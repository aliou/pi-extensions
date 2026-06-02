import { getHeader, parsePercent } from "./headers";
import type { HistoryLine } from "./types";

function sanitizeIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCodexLimitId(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, "_");
}

function codexPrefixToLimitId(prefix: string): string {
  const raw = prefix.toLowerCase().replace(/^x-/, "");
  return normalizeCodexLimitId(raw);
}

function codexHistoryId(
  prefix: string,
  suffix: "primary" | "secondary",
  headers: Record<string, string>,
): string {
  const limitId = codexPrefixToLimitId(prefix);
  if (limitId === "codex") return `codex:${suffix}`;

  const limitName = getHeader(headers, `${prefix}-limit-name`);
  const scope = sanitizeIdPart(
    limitName || limitId.replace(/^codex_?/, "") || limitId,
  );
  return `codex:${scope}:${suffix}`;
}

export function parseCodexHeaders(
  headers: Record<string, string> | undefined,
  at: number,
): HistoryLine[] {
  if (!headers) return [];

  const prefixes = new Set<string>(["x-codex"]);
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (lower.endsWith("-primary-used-percent")) {
      const prefix = lower.slice(0, -"-primary-used-percent".length);
      if (prefix.startsWith("x-codex")) prefixes.add(prefix);
    }
    if (lower.endsWith("-secondary-used-percent")) {
      const prefix = lower.slice(0, -"-secondary-used-percent".length);
      if (prefix.startsWith("x-codex")) prefixes.add(prefix);
    }
  }

  const lines: HistoryLine[] = [];
  for (const prefix of prefixes) {
    const primary = parsePercent(
      getHeader(headers, `${prefix}-primary-used-percent`),
      false,
    );
    if (primary != null) {
      lines.push({
        id: codexHistoryId(prefix, "primary", headers),
        at,
        remaining: 100 - primary,
      });
    }

    const secondary = parsePercent(
      getHeader(headers, `${prefix}-secondary-used-percent`),
      false,
    );
    if (secondary != null) {
      lines.push({
        id: codexHistoryId(prefix, "secondary", headers),
        at,
        remaining: 100 - secondary,
      });
    }
  }

  return lines;
}
