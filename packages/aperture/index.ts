import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

/**
 * The shared subset of the pi-ts-aperture config used by this repository.
 * Unknown fields are retained so updating the URL does not discard extension
 * settings such as proxy, dedicated, or connectors.
 */
export interface ApertureConfig extends Record<string, unknown> {
  /** Aperture gateway base URL, e.g. `http://ai.example-tailnet.ts.net`. */
  baseUrl?: string;
}

/** Path to the global pi-ts-aperture config file. */
export function getApertureConfigPath(): string {
  return join(getAgentDir(), "extensions", "aperture.json");
}

/**
 * Read the complete Aperture config without throwing. This stays synchronous
 * because provider usage reads it while constructing fetch requests.
 */
export function readApertureConfig(): ApertureConfig {
  const path = getApertureConfigPath();
  if (!existsSync(path)) return {};

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (!isRecord(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

/** Resolve the configured base URL, without trailing slashes. */
export function getApertureBaseUrl(): string | undefined {
  const baseUrl = readApertureConfig().baseUrl;
  if (typeof baseUrl !== "string" || !baseUrl) return undefined;
  return baseUrl.replace(/\/+$/, "");
}

/** Persist the complete Aperture config, creating its directory when needed. */
export async function writeApertureConfig(
  config: ApertureConfig,
): Promise<void> {
  const path = getApertureConfigPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

/** Update only the base URL while preserving the rest of Aperture's config. */
export async function setApertureBaseUrl(baseUrl: string): Promise<void> {
  const config = readApertureConfig();
  await writeApertureConfig({
    ...config,
    baseUrl: baseUrl.replace(/\/+$/, ""),
  });
}

function isRecord(value: unknown): value is ApertureConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
