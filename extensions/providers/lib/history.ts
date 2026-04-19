import { appendFile, mkdir, readdir, readFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LimitSample, NormalizedLimit } from "./types";

const MAX_SAMPLES_PER_LIMIT = 30;
const CLEANUP_AGE_MS = 10 * 24 * 60 * 60 * 1000; // 10 days.
const HISTORY_DIR = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "pi",
  "providers",
  "history",
);

// In-memory cache keyed by limit ID.
let cache: Record<string, LimitSample[]> = {};
let loaded = false;

interface HistoryLine {
  id: string;
  at: number;
  remaining: number;
}

function bucketName(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const bucket = Math.floor(d.getUTCHours() / 6) * 6;
  const h = String(bucket).padStart(2, "0");
  return `${y}-${m}-${day}-${h}.jsonl`;
}

function currentBucketPath(): string {
  return join(HISTORY_DIR, bucketName(Date.now()));
}

async function cleanupOldFiles(): Promise<void> {
  try {
    const files = await readdir(HISTORY_DIR);
    const now = Date.now();
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      // Parse date from filename: YYYY-MM-DD-HH.jsonl
      const match = file.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})\.jsonl$/);
      if (!match) continue;
      const fileDate = new Date(
        `${match[1]}-${match[2]}-${match[3]}T${match[4]}:00:00Z`,
      );
      if (Number.isNaN(fileDate.getTime())) continue;
      if (now - fileDate.getTime() > CLEANUP_AGE_MS) {
        await unlink(join(HISTORY_DIR, file)).catch(() => {});
      }
    }
  } catch {
    // Directory may not exist yet.
  }
}

async function loadAllFiles(): Promise<void> {
  cache = {};
  try {
    const files = await readdir(HISTORY_DIR);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl")).sort();
    for (const file of jsonlFiles) {
      try {
        const raw = await readFile(join(HISTORY_DIR, file), "utf-8");
        for (const line of raw.split("\n")) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line) as HistoryLine;
            if (!entry.id || entry.at == null || entry.remaining == null)
              continue;
            const samples = cache[entry.id] ?? [];
            samples.push({ at: entry.at, remaining: entry.remaining });
            cache[entry.id] = samples;
          } catch {
            // Skip malformed lines.
          }
        }
      } catch {
        // Skip unreadable files.
      }
    }
    // Trim each limit to keep newest samples.
    for (const id of Object.keys(cache)) {
      const samples = cache[id];
      if (samples && samples.length > MAX_SAMPLES_PER_LIMIT) {
        cache[id] = samples.slice(-MAX_SAMPLES_PER_LIMIT);
      }
    }
  } catch {
    // Directory may not exist yet.
  }
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  await cleanupOldFiles();
  await loadAllFiles();
}

async function appendEntry(entry: HistoryLine): Promise<void> {
  try {
    await mkdir(HISTORY_DIR, { recursive: true });
    await appendFile(
      currentBucketPath(),
      `${JSON.stringify(entry)}\n`,
      "utf-8",
    );
  } catch {
    // Ignore write errors.
  }
}

function remainingValue(limit: NormalizedLimit): number | null {
  switch (limit.kind) {
    case "fixed-window":
      return limit.capacity != null && limit.used != null
        ? limit.capacity - limit.used
        : 100 - limit.usedPercent;
    case "refillable":
      return limit.remaining;
    case "regen-budget":
      return limit.remainingAmountMinor;
  }
}

function getCapacity(limit: NormalizedLimit): number {
  switch (limit.kind) {
    case "fixed-window":
      return limit.capacity ?? 100;
    case "refillable":
      return limit.capacity;
    case "regen-budget":
      return limit.maxAmountMinor;
  }
}

/**
 * Records a sample for a limit. Detects renewal (remaining jumps up
 * significantly) and resets in-memory history for that limit.
 */
export async function recordSample(limit: NormalizedLimit): Promise<void> {
  await ensureLoaded();
  const remaining = remainingValue(limit);
  if (remaining === null) return;

  const now = Date.now();
  const samples = cache[limit.id] ?? [];

  // Detect renewal: remaining increased by more than 20% of capacity.
  if (samples.length > 0) {
    const last = samples[samples.length - 1];
    if (last && remaining - last.remaining > getCapacity(limit) * 0.2) {
      cache[limit.id] = [];
    }
  }

  const sample: LimitSample = { at: now, remaining };
  const arr = cache[limit.id] ?? [];
  arr.push(sample);
  if (arr.length > MAX_SAMPLES_PER_LIMIT) {
    arr.splice(0, arr.length - MAX_SAMPLES_PER_LIMIT);
  }
  cache[limit.id] = arr;

  await appendEntry({ id: limit.id, at: now, remaining });
}

/**
 * Returns samples for a given limit ID.
 */
export async function getSamples(limitId: string): Promise<LimitSample[]> {
  await ensureLoaded();
  return cache[limitId] ?? [];
}

/**
 * Estimates burn rate (units consumed per minute) from recent samples.
 * Returns null if insufficient data (< 3 samples or < 2 min span).
 *
 * For refillable limits, accounts for expected refills between samples.
 */
export async function estimateBurnRate(
  limitId: string,
  refillRatePerMin?: number,
): Promise<number | null> {
  await ensureLoaded();
  const samples = cache[limitId];
  if (!samples || samples.length < 3) return null;

  const oldest = samples[0] as LimitSample;
  const newest = samples[samples.length - 1] as LimitSample;
  const elapsedMin = (newest.at - oldest.at) / 60_000;
  if (elapsedMin < 2) return null;

  const depleted = oldest.remaining - newest.remaining;
  const refillDuringPeriod = (refillRatePerMin ?? 0) * elapsedMin;
  const actualConsumed = depleted + refillDuringPeriod;

  return Math.max(0, actualConsumed / elapsedMin);
}

/**
 * Records samples for all limits in a snapshot.
 */
export async function recordSnapshotSamples(
  limits: NormalizedLimit[],
): Promise<void> {
  for (const limit of limits) {
    await recordSample(limit);
  }
}
