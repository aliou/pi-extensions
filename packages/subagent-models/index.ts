import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type ExtensionAPI,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";
import type { SubagentModelPreference } from "@harness/agent-kit/models";

export type { SubagentModelPreference } from "@harness/agent-kit/models";

/**
 * Global-only subagent model configuration
 * (`$PI_CODING_AGENT_DIR/settings/subagent-models.json`):
 *
 * ```json
 * {
 *   "advisor": [
 *     { "provider": "anthropic", "model": "claude-opus-4-8", "thinking": "xhigh", "weight": 1 }
 *   ]
 * }
 * ```
 *
 * Each key is a subagent name mapping to its full weighted roster. There are
 * no built-in defaults: a subagent without a configured roster is disabled.
 */
export type SubagentModelsConfig = Record<string, SubagentModelPreference[]>;

export type SubagentModelsLoadResult =
  | { ok: true; config: SubagentModelsConfig; path: string }
  | { ok: false; path: string; reason: "missing" | "invalid" };

/** Path to the global subagent model config file. */
export function getSubagentModelsConfigPath(): string {
  return join(getAgentDir(), "settings", "subagent-models.json");
}

const THINKING_LEVELS = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPreference(value: unknown): value is SubagentModelPreference {
  return (
    isRecord(value) &&
    typeof value.provider === "string" &&
    typeof value.model === "string" &&
    typeof value.weight === "number" &&
    typeof value.thinking === "string" &&
    THINKING_LEVELS.has(value.thinking)
  );
}

function parseConfig(value: unknown): SubagentModelsConfig | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length === 0) return undefined;
  const config: SubagentModelsConfig = {};
  for (const [name, roster] of entries) {
    if (!Array.isArray(roster) || roster.length === 0) return undefined;
    if (!roster.every(isPreference)) return undefined;
    config[name] = roster;
  }
  return config;
}

let cache: Promise<SubagentModelsLoadResult> | undefined;

/**
 * Load the global subagent model config. Async; the result is cached for the
 * process lifetime (call {@link resetSubagentModelsCache} in tests to clear).
 * Never throws.
 */
export function loadSubagentModels(): Promise<SubagentModelsLoadResult> {
  cache ??= (async (): Promise<SubagentModelsLoadResult> => {
    const path = getSubagentModelsConfigPath();
    let raw: string;
    try {
      raw = await readFile(path, "utf-8");
    } catch {
      return { ok: false, path, reason: "missing" };
    }
    try {
      const config = parseConfig(JSON.parse(raw));
      if (!config) return { ok: false, path, reason: "invalid" };
      return { ok: true, config, path };
    } catch {
      return { ok: false, path, reason: "invalid" };
    }
  })();
  return cache;
}

/**
 * Resolve the configured roster for one subagent. Returns undefined when the
 * config is missing or invalid, or when it loaded but has no roster under
 * this name.
 */
export async function getSubagentModelPreferences(
  name: string,
): Promise<SubagentModelPreference[] | undefined> {
  const result = await loadSubagentModels();
  if (!result.ok) return undefined;
  return result.config[name];
}

/**
 * User-facing reason for a failed or name-less roster resolution, used by
 * extensions that disable a subagent when it has no configured roster.
 */
export async function describeMissingRoster(name: string): Promise<string> {
  const result = await loadSubagentModels();
  if (!result.ok) {
    return result.reason === "missing"
      ? `${result.path} is missing`
      : `${result.path} is invalid`;
  }
  return `${result.path} has no model roster for "${name}"`;
}

/** Clear the cached config. Test-only. */
export function resetSubagentModelsCache(): void {
  cache = undefined;
}

export interface ConfiguredSubagent<Subagent> {
  /** The subagent when configured, undefined when disabled. */
  subagent: Subagent | undefined;
  /** Whether the subagent has a configured model roster. */
  configured: boolean;
  /** Register tools/commands; no-op when the subagent is disabled. */
  register(): void;
  /** Notify the user once per session when the subagent is disabled. */
  notifyOnSessionStart(): void;
}

/**
 * Wrap a subagent created with an async roster resolver. When the resolver
 * produced no roster the subagent is disabled: `register()` is a no-op and
 * `notifyOnSessionStart()` surfaces a single warning with the reason.
 *
 * When `register` is omitted the subagent's own `register()` is used.
 */
export function configuredSubagent<Subagent extends { register(): void }>(
  pi: ExtensionAPI,
  name: string,
  label: string,
  subagent: Subagent,
  configured: boolean,
  register?: () => void,
): ConfiguredSubagent<Subagent> {
  const doRegister = register ?? (() => subagent.register());
  return {
    subagent: configured ? subagent : undefined,
    configured,
    register(): void {
      if (configured) doRegister();
    },
    notifyOnSessionStart(): void {
      if (configured) return;
      pi.on("session_start", async (_event, ctx) => {
        const reason = await describeMissingRoster(name);
        ctx.ui.notify(`${label} subagent disabled: ${reason}`, "warning");
      });
    },
  };
}
