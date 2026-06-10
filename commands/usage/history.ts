import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ProviderUsageSnapshot,
  UsageQuota,
} from "@harness/provider-usage";

const MAX_HISTORY_AGE_MS = 72 * 60 * 60_000;
const MIN_SAMPLE_SEPARATION_MS = 5 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

export type ProjectionHint =
  | { kind: "stable" }
  | { kind: "projected"; usedPercent: number; horizonMs: number }
  | { kind: "empty"; timeToEmptyMs: number };

interface UsageHistoryEntry {
  version: 1;
  recordedAt: string;
  samples: UsageHistorySample[];
}

interface UsageHistorySample {
  key: string;
  at: string;
  remaining: number;
  capacity: number;
  refillAmount?: number;
  refillIntervalMs?: number;
}

export async function appendUsageHistory(
  snapshots: ProviderUsageSnapshot[],
): Promise<void> {
  const samples = snapshots.flatMap(samplesFromSnapshot);
  if (samples.length === 0) return;

  const path = historyPathForDate(new Date());
  await mkdir(dirname(path), { recursive: true });
  const entry: UsageHistoryEntry = {
    version: 1,
    recordedAt: new Date().toISOString(),
    samples,
  };
  await writeFile(path, `${JSON.stringify(entry)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

export async function buildProjectionHints(
  snapshots: ProviderUsageSnapshot[],
): Promise<Map<string, ProjectionHint>> {
  const entries = await readHistoryEntries();
  const historicalSamples = entries.flatMap((entry) => entry.samples);
  const currentSamples = snapshots.flatMap(samplesFromSnapshot);
  const allSamples = [...historicalSamples, ...currentSamples].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  const hints = new Map<string, ProjectionHint>();

  for (const current of currentSamples) {
    const hint = projectionForSample(current, allSamples);
    if (hint) hints.set(current.key, hint);
  }

  return hints;
}

export function quotaHistoryKey(quota: UsageQuota): string {
  return `${quota.provider}:${quota.id}`;
}

function samplesFromSnapshot(
  snapshot: ProviderUsageSnapshot,
): UsageHistorySample[] {
  return snapshot.quotas
    .map(sampleFromQuota)
    .filter((sample): sample is UsageHistorySample => sample != null);
}

function sampleFromQuota(quota: UsageQuota): UsageHistorySample | null {
  if (quota.amount.capacity == null) return null;
  const remaining =
    quota.amount.remaining ??
    (quota.amount.used == null
      ? undefined
      : quota.amount.capacity - quota.amount.used);
  if (remaining == null) return null;

  const base: UsageHistorySample = {
    key: quotaHistoryKey(quota),
    at: quota.updatedAt.toISOString(),
    remaining,
    capacity: quota.amount.capacity,
  };

  if (quota.replenishment.kind === "discrete-tick") {
    return {
      ...base,
      refillAmount: quota.replenishment.amount,
      refillIntervalMs: quota.replenishment.intervalMs,
    };
  }

  if (quota.provider === "synthetic" && quota.id === "weeklyTokenLimit") {
    return {
      ...base,
      refillAmount: quota.amount.capacity,
      refillIntervalMs: WEEK_MS,
    };
  }

  return base;
}

function projectionForSample(
  current: UsageHistorySample,
  samples: UsageHistorySample[],
): ProjectionHint | null {
  if (!current.refillAmount || !current.refillIntervalMs) return null;

  const currentAt = Date.parse(current.at);
  const minAt = currentAt - MAX_HISTORY_AGE_MS;
  const previous = [...samples].reverse().find((sample) => {
    if (sample.key !== current.key) return false;
    if (sample.capacity !== current.capacity) return false;
    const at = Date.parse(sample.at);
    return at < currentAt - MIN_SAMPLE_SEPARATION_MS && at >= minAt;
  });
  if (!previous) return null;

  const previousAt = Date.parse(previous.at);
  const dtMs = currentAt - previousAt;
  if (dtMs <= 0) return null;

  const refillRate = current.refillAmount / current.refillIntervalMs;
  const expectedRefill = refillRate * dtMs;
  const deltaRemaining = current.remaining - previous.remaining;
  const grossBurn = Math.max(0, expectedRefill - deltaRemaining);
  const burnRate = grossBurn / dtMs;
  const netDrainRate = burnRate - refillRate;

  if (netDrainRate <= 0) return { kind: "stable" };

  const timeToEmptyMs = current.remaining / netDrainRate;
  if (timeToEmptyMs < DAY_MS) return { kind: "empty", timeToEmptyMs };

  const horizonMs =
    current.key === "synthetic:weeklyTokenLimit"
      ? DAY_MS
      : current.refillIntervalMs;
  const projectedRemaining = clamp(
    current.remaining - netDrainRate * horizonMs,
    0,
    current.capacity,
  );
  return {
    kind: "projected",
    usedPercent: Math.round(100 * (1 - projectedRemaining / current.capacity)),
    horizonMs,
  };
}

async function readHistoryEntries(): Promise<UsageHistoryEntry[]> {
  const dir = historyDir();
  if (!existsSync(dir)) return [];

  const cutoff = Date.now() - MAX_HISTORY_AGE_MS;
  const files = await historyFilesSince(dir, cutoff);
  const entries: UsageHistoryEntry[] = [];

  for (const file of files) {
    const text = await readFile(join(dir, file), "utf8").catch(() => "");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as UsageHistoryEntry;
        if (entry.version !== 1 || Date.parse(entry.recordedAt) < cutoff)
          continue;
        entries.push(entry);
      } catch {
        // Keep the reader best-effort; one corrupt JSONL line should not break /usage.
        entries.splice(entries.length, 0);
      }
    }
  }

  return entries;
}

async function historyFilesSince(
  dir: string,
  cutoff: number,
): Promise<string[]> {
  const files = await readdir(dir).catch(() => []);
  return files
    .filter((file) => file.endsWith(".jsonl"))
    .filter((file) => {
      const bucket = dateFromHistoryFile(file);
      return bucket != null && bucket.getTime() + 6 * 60 * 60_000 >= cutoff;
    })
    .sort();
}

function historyPathForDate(date: Date): string {
  return join(historyDir(), `${historyBucketName(date)}.jsonl`);
}

function historyDir(): string {
  const base = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(base, "pi-harness", "provider-usage", "history");
}

function historyBucketName(date: Date): string {
  const bucketHour = Math.floor(date.getUTCHours() / 6) * 6;
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(bucketHour),
  ].join("-");
}

function dateFromHistoryFile(file: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})\.jsonl$/.exec(file);
  if (!match) return null;
  const [, year, month, day, hour] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour)),
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
