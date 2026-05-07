import type { AuthStorage } from "@earendil-works/pi-coding-agent";
import type {
  NormalizedLimit,
  ProviderSnapshot,
  ProviderStatus,
} from "../types";
import type { ProviderAdapter } from "./base";

const BASE_URL = "https://opencode.ai";
const SERVER_URL = "https://opencode.ai/_server";
const WORKSPACES_SERVER_ID =
  "def39973159c7f0483d8793a822b8dbb10d067e12c65455fcb4608459ba0234f";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

// Cookie names that carry auth on opencode.ai
const AUTH_COOKIE_NAMES = new Set(["auth", "__Host-auth"]);

// --- Helpers ---

function filterCookieHeader(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const pairs = raw.split(";").map((p) => p.trim());
  const filtered = pairs.filter((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 0) return false;
    const name = pair.slice(0, eq).trim();
    return AUTH_COOKIE_NAMES.has(name);
  });
  return filtered.length > 0 ? filtered.join("; ") : undefined;
}

function timeoutSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

function looksSignedOut(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("login") ||
    lower.includes("sign in") ||
    lower.includes("auth/authorize") ||
    lower.includes("not associated with an account") ||
    lower.includes('actor of type "public"')
  );
}

function extractDouble(pattern: RegExp, text: string): number | null {
  const match = pattern.exec(text);
  if (!match || match[1] == null) return null;
  const n = Number.parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

function extractInt(pattern: RegExp, text: string): number | null {
  const match = pattern.exec(text);
  if (!match || match[1] == null) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

// --- JSON parsing ---

const PERCENT_KEYS = [
  "usagePercent",
  "usedPercent",
  "percentUsed",
  "percent",
  "usage_percent",
  "used_percent",
  "utilization",
  "utilizationPercent",
  "utilization_percent",
  "usage",
];

const RESET_IN_KEYS = [
  "resetInSec",
  "resetInSeconds",
  "resetSeconds",
  "reset_sec",
  "reset_in_sec",
  "resetsInSec",
  "resetsInSeconds",
  "resetIn",
  "resetSec",
];

const RESET_AT_KEYS = [
  "resetAt",
  "resetsAt",
  "reset_at",
  "resets_at",
  "nextReset",
  "next_reset",
  "renewAt",
  "renew_at",
];

function doubleValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function intValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw === "string") {
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dateValue(raw: unknown): Date | null {
  if (raw == null) return null;
  const num = doubleValue(raw);
  if (num !== null) {
    if (num > 1_000_000_000_000) return new Date(num);
    if (num > 1_000_000_000) return new Date(num * 1000);
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function firstValue<K extends string>(
  dict: Record<string, unknown>,
  keys: K[],
): unknown {
  for (const key of keys) {
    if (key in dict && dict[key] !== undefined && dict[key] !== null) {
      return dict[key];
    }
  }
  return undefined;
}

function parseWindow(
  dict: Record<string, unknown>,
  now: Date,
): { percent: number; resetInSec: number } | null {
  let percent: number | null = null;

  for (const key of PERCENT_KEYS) {
    const v = doubleValue(dict[key]);
    if (v !== null) {
      percent = v;
      break;
    }
  }

  if (percent === null) {
    const usedKeys = ["used", "usage", "consumed", "count", "usedTokens"];
    const limitKeys = ["limit", "total", "quota", "max", "cap", "tokenLimit"];
    const used = doubleValue(firstValue(dict, usedKeys));
    const limit = doubleValue(firstValue(dict, limitKeys));
    if (used !== null && limit !== null && limit > 0) {
      percent = (used / limit) * 100;
    }
  }

  if (percent === null) return null;

  // Normalize: values <= 1.0 are fractions (0-1); scale to 0-100.
  let resolvedPercent = percent;
  if (resolvedPercent <= 1.0 && resolvedPercent >= 0) {
    resolvedPercent *= 100;
  }
  resolvedPercent = Math.max(0, Math.min(100, resolvedPercent));

  let resetInSec: number | null = null;
  for (const key of RESET_IN_KEYS) {
    const v = intValue(dict[key]);
    if (v !== null) {
      resetInSec = v;
      break;
    }
  }

  if (resetInSec === null) {
    for (const key of RESET_AT_KEYS) {
      const v = dateValue(dict[key]);
      if (v !== null) {
        resetInSec = Math.max(
          0,
          Math.round((v.getTime() - now.getTime()) / 1000),
        );
        break;
      }
    }
  }

  return { percent: resolvedPercent, resetInSec: Math.max(0, resetInSec ?? 0) };
}

function firstDict(
  dict: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const val = dict[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return val as Record<string, unknown>;
    }
  }
  return null;
}

interface ParsedSubscription {
  rollingUsagePercent: number;
  weeklyUsagePercent: number;
  monthlyUsagePercent: number;
  hasMonthlyUsage: boolean;
  rollingResetInSec: number;
  weeklyResetInSec: number;
  monthlyResetInSec: number;
}

function parseSubscriptionFromJSON(
  obj: unknown,
  now: Date,
): ParsedSubscription | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const dict = obj as Record<string, unknown>;

  const result = tryParseFromDict(dict, now);
  if (result) return result;

  // Try nested keys.
  for (const key of ["data", "result", "usage", "billing", "payload"]) {
    const nested = dict[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const r = tryParseFromDict(nested as Record<string, unknown>, now);
      if (r) return r;
    }
  }

  return tryParseFromCandidates(dict, now);
}

function tryParseFromDict(
  dict: Record<string, unknown>,
  now: Date,
): ParsedSubscription | null {
  // Recurse into "usage" if present.
  if (
    dict.usage &&
    typeof dict.usage === "object" &&
    !Array.isArray(dict.usage)
  ) {
    const inner = tryParseFromDict(dict.usage as Record<string, unknown>, now);
    if (inner) return inner;
  }

  const rollingKeys = [
    "rollingUsage",
    "rolling",
    "rolling_usage",
    "rollingWindow",
    "rolling_window",
  ];
  const weeklyKeys = [
    "weeklyUsage",
    "weekly",
    "weekly_usage",
    "weeklyWindow",
    "weekly_window",
  ];
  const monthlyKeys = [
    "monthlyUsage",
    "monthly",
    "monthly_usage",
    "monthlyWindow",
    "monthly_window",
  ];

  const rolling = firstDict(dict, rollingKeys);
  const weekly = firstDict(dict, weeklyKeys);
  if (!rolling || !weekly) return null;

  const monthly = firstDict(dict, monthlyKeys);
  return buildSnapshot(rolling, weekly, monthly, now);
}

function buildSnapshot(
  rolling: Record<string, unknown>,
  weekly: Record<string, unknown>,
  monthly: Record<string, unknown> | null,
  now: Date,
): ParsedSubscription | null {
  const rw = parseWindow(rolling, now);
  const ww = parseWindow(weekly, now);
  if (!rw || !ww) return null;

  const mw = monthly ? parseWindow(monthly, now) : null;

  return {
    rollingUsagePercent: rw.percent,
    weeklyUsagePercent: ww.percent,
    monthlyUsagePercent: mw?.percent ?? 0,
    hasMonthlyUsage: mw !== null,
    rollingResetInSec: rw.resetInSec,
    weeklyResetInSec: ww.resetInSec,
    monthlyResetInSec: mw?.resetInSec ?? 0,
  };
}

interface WindowCandidate {
  percent: number;
  resetInSec: number;
  pathLower: string;
}

function collectWindowCandidates(
  obj: unknown,
  now: Date,
  path: string[] = [],
): WindowCandidate[] {
  const results: WindowCandidate[] = [];

  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const dict = obj as Record<string, unknown>;
    const w = parseWindow(dict, now);
    if (w) {
      results.push({
        percent: w.percent,
        resetInSec: w.resetInSec,
        pathLower: path.join(".").toLowerCase(),
      });
    }
    for (const [key, value] of Object.entries(dict)) {
      results.push(...collectWindowCandidates(value, now, [...path, key]));
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(
        ...collectWindowCandidates(obj[i], now, [...path, `[${i}]`]),
      );
    }
  }

  return results;
}

function tryParseFromCandidates(
  dict: Record<string, unknown>,
  now: Date,
): ParsedSubscription | null {
  const candidates = collectWindowCandidates(dict, now);
  if (candidates.length === 0) return null;

  const rollingCandidates = candidates.filter(
    (c) =>
      c.pathLower.includes("rolling") ||
      c.pathLower.includes("hour") ||
      c.pathLower.includes("5h") ||
      c.pathLower.includes("5-hour"),
  );
  const weeklyCandidates = candidates.filter(
    (c) => c.pathLower.includes("weekly") || c.pathLower.includes("week"),
  );
  const monthlyCandidates = candidates.filter(
    (c) => c.pathLower.includes("monthly") || c.pathLower.includes("month"),
  );

  const pickShorter = (arr: WindowCandidate[]): WindowCandidate | null =>
    arr.length > 0
      ? arr.reduce((best, c) =>
          c.resetInSec < best.resetInSec ||
          (c.resetInSec === best.resetInSec && c.percent > best.percent)
            ? c
            : best,
        )
      : null;

  const pickLonger = (arr: WindowCandidate[]): WindowCandidate | null =>
    arr.length > 0
      ? arr.reduce((best, c) =>
          c.resetInSec > best.resetInSec ||
          (c.resetInSec === best.resetInSec && c.percent > best.percent)
            ? c
            : best,
        )
      : null;

  const rolling = pickShorter(rollingCandidates) ?? pickShorter(candidates);
  const weekly = pickLonger(weeklyCandidates) ?? pickLonger(candidates) ?? null;
  const monthly = pickLonger(monthlyCandidates);

  if (!rolling || !weekly) return null;

  if (!rolling || !weekly) return null;

  return {
    rollingUsagePercent: rolling.percent,
    weeklyUsagePercent: weekly?.percent,
    monthlyUsagePercent: monthly?.percent ?? 0,
    hasMonthlyUsage: monthly !== null,
    rollingResetInSec: rolling.resetInSec,
    weeklyResetInSec: weekly?.resetInSec ?? 0,
    monthlyResetInSec: monthly?.resetInSec ?? 0,
  };
}

function parseSubscriptionText(
  text: string,
  now: Date,
): ParsedSubscription | null {
  // Try JSON first.
  try {
    const obj = JSON.parse(text);
    const result = parseSubscriptionFromJSON(obj, now);
    if (result) return result;
  } catch (_error) {
    void _error;
    // Not JSON, try regex.
  }

  // Regex fallback (serialized JS objects).
  const rollingPercent = extractDouble(
    /rollingUsage[^}]*?usagePercent\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
    text,
  );
  const rollingReset = extractInt(
    /rollingUsage[^}]*?resetInSec\s*:\s*([0-9]+)/,
    text,
  );
  const weeklyPercent = extractDouble(
    /weeklyUsage[^}]*?usagePercent\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
    text,
  );
  const weeklyReset = extractInt(
    /weeklyUsage[^}]*?resetInSec\s*:\s*([0-9]+)/,
    text,
  );

  if (
    rollingPercent === null ||
    rollingReset === null ||
    weeklyPercent === null ||
    weeklyReset === null
  ) {
    return null;
  }

  const monthlyPercent = extractDouble(
    /monthlyUsage[^}]*?usagePercent\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
    text,
  );
  const monthlyReset = extractInt(
    /monthlyUsage[^}]*?resetInSec\s*:\s*([0-9]+)/,
    text,
  );

  return {
    rollingUsagePercent: rollingPercent,
    weeklyUsagePercent: weeklyPercent,
    monthlyUsagePercent: monthlyPercent ?? 0,
    hasMonthlyUsage: monthlyPercent !== null || monthlyReset !== null,
    rollingResetInSec: rollingReset,
    weeklyResetInSec: weeklyReset,
    monthlyResetInSec: monthlyReset ?? 0,
  };
}

// --- Workspace ID parsing ---

function parseWorkspaceIDsFromText(text: string): string[] {
  const pattern = /id\s*:\s*"?(wrk_[A-Za-z0-9]+)"?/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((match = pattern.exec(text)) !== null) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function parseWorkspaceIDsFromJSON(obj: unknown): string[] {
  const ids: string[] = [];
  collectWorkspaceIDs(obj, ids);
  return ids;
}

function collectWorkspaceIDs(obj: unknown, out: string[]): void {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      collectWorkspaceIDs(value, out);
    }
  } else if (Array.isArray(obj)) {
    for (const value of obj) {
      collectWorkspaceIDs(value, out);
    }
  } else if (
    typeof obj === "string" &&
    obj.startsWith("wrk_") &&
    !out.includes(obj)
  ) {
    out.push(obj);
  }
}

// NormalizeWorkspaceID is not needed for the CLI adapter;
// workspace ID is resolved via the _server endpoint.

// --- Network ---

async function fetchServerText(
  cookieHeader: string,
  serverID: string,
  args: unknown[] | null,
  method: "GET" | "POST",
  referer: string,
  _timeoutMs: number,
  signal: AbortSignal,
): Promise<string> {
  let url: string;
  const headers: Record<string, string> = {
    Cookie: cookieHeader,
    "X-Server-Id": serverID,
    "X-Server-Instance": `server-fn:${crypto.randomUUID()}`,
    "User-Agent": USER_AGENT,
    Origin: BASE_URL,
    Referer: referer,
    Accept: "text/javascript, application/json;q=0.9, */*;q=0.8",
  };

  let body: string | undefined;

  if (method === "GET") {
    const params = new URLSearchParams({ id: serverID });
    if (args && args.length > 0) {
      params.set("args", JSON.stringify(args));
    }
    url = `${SERVER_URL}?${params.toString()}`;
  } else {
    url = SERVER_URL;
    if (args) {
      body = JSON.stringify(args);
      headers["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    signal,
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid credentials");
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (looksSignedOut(text)) throw new Error("Invalid credentials");
      // Try to extract error message from JSON.
      try {
        const obj = JSON.parse(text);
        message = obj.message || obj.error || obj.detail || message;
      } catch (_error) {
        void _error;
        // Not JSON.
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Invalid credentials") throw e;
    }
    throw new Error(message);
  }

  const text = await res.text();
  if (looksSignedOut(text)) throw new Error("Invalid credentials");
  return text;
}

async function fetchWorkspaceID(
  cookieHeader: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<string> {
  // GET workspaces
  const text = await fetchServerText(
    cookieHeader,
    WORKSPACES_SERVER_ID,
    null,
    "GET",
    BASE_URL,
    timeoutMs,
    signal,
  );

  let ids = parseWorkspaceIDsFromText(text);
  if (ids.length === 0) {
    // Try JSON parsing.
    try {
      const obj = JSON.parse(text);
      ids = parseWorkspaceIDsFromJSON(obj);
    } catch (_error) {
      void _error;
      // Ignore.
    }
  }

  if (ids.length === 0) {
    // Retry with POST.
    const fallback = await fetchServerText(
      cookieHeader,
      WORKSPACES_SERVER_ID,
      [],
      "POST",
      BASE_URL,
      timeoutMs,
      signal,
    );
    ids = parseWorkspaceIDsFromText(fallback);
    if (ids.length === 0) {
      try {
        const obj = JSON.parse(fallback);
        ids = parseWorkspaceIDsFromJSON(obj);
      } catch (_error) {
        void _error;
        // Ignore.
      }
    }
    if (ids.length === 0) {
      throw new Error("Missing workspace ID");
    }
  }

  return ids[0] ?? "";
}

async function fetchUsagePage(
  cookieHeader: string,
  workspaceID: string,
  _timeoutMs: number,
  signal: AbortSignal,
): Promise<string> {
  const url = `${BASE_URL}/workspace/${workspaceID}/go`;
  const headers: Record<string, string> = {
    Cookie: cookieHeader,
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  const res = await fetch(url, { headers, signal });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid credentials");
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();
  if (looksSignedOut(text)) throw new Error("Invalid credentials");
  return text;
}

// --- Adapter ---

export const opencodeGoAdapter: ProviderAdapter = {
  provider: "opencode-go",

  async fetch(
    authStorage: AuthStorage,
    signal?: AbortSignal,
  ): Promise<ProviderSnapshot> {
    const now = new Date();

    // Auth: cookie header stored under a dedicated key separate from
    // the API key. The "opencode-go" key is reserved for the chat
    // completions API key; usage tracking uses browser cookies stored
    // under "opencode-go-usage".
    const credential = authStorage.get("opencode-go-usage") as
      | { type: string; key?: string }
      | undefined;
    const storedCookie = await authStorage.getApiKey("opencode-go-usage");
    const rawCookie = credential?.key ?? storedCookie;

    if (!rawCookie) {
      return {
        provider: "opencode-go",
        displayName: "OpenCode Go",
        status: "unknown",
        limits: [],
        error: "Not configured (set opencode-go-usage cookie in auth)",
        fetchedAt: now,
      };
    }

    const cookieHeader = filterCookieHeader(rawCookie);
    if (!cookieHeader) {
      return {
        provider: "opencode-go",
        displayName: "OpenCode Go",
        status: "unknown",
        limits: [],
        error: "No auth cookie found in opencode-go-usage credential",
        fetchedAt: now,
      };
    }

    const combined = timeoutSignal(15000, signal);

    try {
      // 1. Resolve workspace ID.
      const workspaceID = await fetchWorkspaceID(cookieHeader, 15000, combined);

      // 2. Fetch usage page.
      const pageText = await fetchUsagePage(
        cookieHeader,
        workspaceID,
        15000,
        combined,
      );

      // 3. Parse subscription data.
      const parsed = parseSubscriptionText(pageText, now);
      if (!parsed) {
        return {
          provider: "opencode-go",
          displayName: "OpenCode Go",
          status: "unknown",
          limits: [],
          error: "Could not parse usage data",
          fetchedAt: now,
        };
      }

      // 4. Build normalized limits.
      const limits: NormalizedLimit[] = [];

      // Rolling 5h window.
      const rollingResetsAt = new Date(
        now.getTime() + parsed.rollingResetInSec * 1000,
      );
      limits.push({
        kind: "fixed-window",
        provider: "opencode-go",
        id: "opencode-go:rolling-five-hour",
        name: "5h window",
        usedPercent: parsed.rollingUsagePercent,
        resetsAt: rollingResetsAt,
        windowSeconds: 5 * 60 * 60,
        updatedAt: now,
      });

      // Weekly window.
      const weeklyResetsAt = new Date(
        now.getTime() + parsed.weeklyResetInSec * 1000,
      );
      limits.push({
        kind: "fixed-window",
        provider: "opencode-go",
        id: "opencode-go:weekly",
        name: "7d window",
        usedPercent: parsed.weeklyUsagePercent,
        resetsAt: weeklyResetsAt,
        windowSeconds: 7 * 24 * 60 * 60,
        updatedAt: now,
      });

      // Monthly window (optional).
      if (parsed.hasMonthlyUsage) {
        const monthlyResetsAt = new Date(
          now.getTime() + parsed.monthlyResetInSec * 1000,
        );
        limits.push({
          kind: "fixed-window",
          provider: "opencode-go",
          id: "opencode-go:monthly",
          name: "30d window",
          usedPercent: parsed.monthlyUsagePercent,
          resetsAt: monthlyResetsAt,
          windowSeconds: 30 * 24 * 60 * 60,
          updatedAt: now,
        });
      }

      return {
        provider: "opencode-go",
        displayName: "OpenCode Go",
        status: "operational",
        limits,
        fetchedAt: now,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const status: ProviderStatus =
        message === "Invalid credentials" ? "degraded" : "unknown";
      return {
        provider: "opencode-go",
        displayName: "OpenCode Go",
        status,
        limits: [],
        error: message,
        fetchedAt: now,
      };
    }
  },
};
