/**
 * Preset Extension
 *
 * Allows defining named presets that configure the model and subagent gateway.
 * Presets are defined in JSON config files and can be activated via CLI flag
 * or /preset command.
 *
 * Config files (merged, project takes precedence):
 * - ~/.pi/agent/presets.json (global)
 * - .pi/presets.json (project-local)
 *
 * Example presets.json:
 * ```json
 * {
 *   "$schema": "https://raw.githubusercontent.com/aliou/pi-extensions/main/extensions/preset/schema.json",
 *   "default": {
 *     "provider": "anthropic",
 *     "model": "claude-opus-4-5",
 *     "thinking": "medium",
 *     "gateway": "default"
 *   },
 *   "opencode": {
 *     "provider": "opencode",
 *     "model": "claude-opus-4-5",
 *     "thinking": "medium",
 *     "gateway": "zen"
 *   }
 * }
 * ```
 *
 * Usage:
 * - `pi --preset fast` - start with fast preset
 * - `/preset` - show selector to switch presets mid-session
 * - `/preset smart` - switch to smart preset directly
 *
 * The gateway value is written to session state and can be read by other
 * extensions (e.g., amp) to configure subagent model routing.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupPresetHooks } from "./hooks";

export default function (pi: ExtensionAPI) {
  setupPresetHooks(pi);
}

// Re-export types for external use
export type { Gateway, Preset, PresetsConfig } from "./types";
