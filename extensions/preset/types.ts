/**
 * Types for the preset extension.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/** Supported gateways for subagent routing */
export type Gateway = "default" | "zen" | "openrouter";

/** Thinking level - extracted from ExtensionAPI.setThinkingLevel */
export type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0];

/** Preset configuration */
export interface Preset {
  /** Provider name (e.g., "anthropic", "google") */
  provider?: string;
  /** Model ID (e.g., "claude-sonnet-4-5") */
  model?: string;
  /** Thinking level */
  thinking?: ThinkingLevel;
  /** Gateway for subagent model routing */
  gateway?: Gateway;
}

/** Map of preset names to configurations */
export interface PresetsConfig {
  [name: string]: Preset;
}

/** Session state entry for gateway config (read by amp extension) */
export interface PresetGatewayEntry {
  gateway: Gateway;
}

/** Session state entry for active preset (for restore on session resume) */
export interface PresetStateEntry {
  name: string;
}
