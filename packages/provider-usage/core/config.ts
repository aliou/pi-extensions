import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

/**
 * Simple, sync config for the provider-usage package.
 *
 * Stored at `~/.pi/agent/extensions/provider-usage.json`. We intentionally do
 * not use ConfigLoader here: the only field today is the Aperture base URL,
 * which the `/usage` command prompts for on first run.
 *
 * @see {@link https://tailscale.com/docs/features/aperture} for Aperture.
 */

export interface ProviderUsageConfig {
  /** Aperture gateway base URL, e.g. `http://ai.tetra-albacore.ts.net`. */
  apertureBaseUrl?: string;
}

const CONFIG_NAME = "provider-usage";

/** Path to the provider-usage config file. */
export function getProviderUsageConfigPath(): string {
  return join(getAgentDir(), "extensions", `${CONFIG_NAME}.json`);
}

/**
 * Read the provider-usage config. Returns an empty config if the file is
 * missing or unreadable. Sync so callers (including the fetch path) can use
 * it without awaiting.
 */
export function readProviderUsageConfig(): ProviderUsageConfig {
  const path = getProviderUsageConfigPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;
    const apertureBaseUrl = record.apertureBaseUrl;
    return typeof apertureBaseUrl === "string" ? { apertureBaseUrl } : {};
  } catch {
    return {};
  }
}

/** Resolve the Aperture base URL from config, trimmed of trailing slashes. */
export function getApertureBaseUrl(): string | undefined {
  const url = readProviderUsageConfig().apertureBaseUrl;
  return url ? url.replace(/\/+$/, "") : undefined;
}

/** Persist the provider-usage config to disk, creating the dir if needed. */
export async function writeProviderUsageConfig(
  config: ProviderUsageConfig,
): Promise<void> {
  const path = getProviderUsageConfigPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

/** Set and persist just the Aperture base URL. */
export async function setApertureBaseUrl(baseUrl: string): Promise<void> {
  const existing = readProviderUsageConfig();
  await writeProviderUsageConfig({
    ...existing,
    apertureBaseUrl: baseUrl.replace(/\/+$/, ""),
  });
}
