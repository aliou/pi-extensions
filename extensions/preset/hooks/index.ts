/**
 * Preset extension hooks.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { loadPresets } from "../config";
import type { Preset, PresetStateEntry, PresetsConfig } from "../types";

/** Session state custom type for gateway config */
const GATEWAY_ENTRY_TYPE = "preset-gateway";

/** Session state custom type for active preset */
const STATE_ENTRY_TYPE = "preset-state";

/** Module state */
let presets: PresetsConfig = {};
let activePresetName: string | undefined;
let activePreset: Preset | undefined;

/**
 * Apply a preset configuration.
 */
async function applyPreset(
  pi: ExtensionAPI,
  name: string,
  preset: Preset,
  ctx: ExtensionContext,
): Promise<boolean> {
  // Apply model if specified
  if (preset.provider && preset.model) {
    const model = ctx.modelRegistry.find(preset.provider, preset.model);
    if (model) {
      const success = await pi.setModel(model);
      if (!success) {
        ctx.ui.notify(
          `Preset "${name}": No API key for ${preset.provider}/${preset.model}`,
          "warning",
        );
      }
    } else {
      ctx.ui.notify(
        `Preset "${name}": Model ${preset.provider}/${preset.model} not found`,
        "warning",
      );
    }
  }

  // Apply thinking level if specified
  if (preset.thinking) {
    pi.setThinkingLevel(preset.thinking);
  }

  // Write gateway to session state (for amp extension to read)
  if (preset.gateway) {
    pi.appendEntry(GATEWAY_ENTRY_TYPE, { gateway: preset.gateway });
  }

  activePresetName = name;
  activePreset = preset;

  return true;
}

/**
 * Update status bar indicator.
 */
function updateStatus(ctx: ExtensionContext): void {
  if (activePresetName) {
    ctx.ui.setStatus(
      "preset",
      ctx.ui.theme.fg("accent", `preset:${activePresetName}`),
    );
  } else {
    ctx.ui.setStatus("preset", undefined);
  }
}

/**
 * Build description string for a preset.
 */
function buildPresetDescription(preset: Preset): string {
  const parts: string[] = [];

  if (preset.provider && preset.model) {
    parts.push(`${preset.provider}/${preset.model}`);
  }

  if (preset.thinking) {
    parts.push(`thinking:${preset.thinking}`);
  }

  if (preset.gateway) {
    parts.push(`gateway:${preset.gateway}`);
  }

  return parts.join(" | ");
}

/**
 * Show preset selector UI.
 */
async function showPresetSelector(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  // Dynamic import to avoid loading TUI components at module load time
  const { Container, SelectList, Text } = await import("@mariozechner/pi-tui");
  const { DynamicBorder } = await import("@mariozechner/pi-coding-agent");

  const presetNames = Object.keys(presets);
  if (presetNames.length === 0) {
    ctx.ui.notify(
      "No presets defined. Add presets to ~/.pi/agent/presets.json or .pi/presets.json",
      "warning",
    );
    return;
  }

  interface SelectItem {
    value: string;
    label: string;
    description?: string;
  }

  const items: SelectItem[] = presetNames.map((name) => {
    const preset = presets[name];
    const isActive = name === activePresetName;
    return {
      value: name,
      label: isActive ? `${name} (active)` : name,
      description: buildPresetDescription(preset),
    };
  });

  // Add "None" option to clear preset
  items.push({
    value: "(none)",
    label: "(none)",
    description: "Clear active preset",
  });

  const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();
    container.addChild(
      new DynamicBorder((str: string) => theme.fg("accent", str)),
    );
    container.addChild(
      new Text(theme.fg("accent", theme.bold("Select Preset"))),
    );

    const selectList = new SelectList(items, Math.min(items.length, 10), {
      selectedPrefix: (text: string) => theme.fg("accent", text),
      selectedText: (text: string) => theme.fg("accent", text),
      description: (text: string) => theme.fg("muted", text),
      scrollInfo: (text: string) => theme.fg("dim", text),
      noMatch: (text: string) => theme.fg("warning", text),
    });

    selectList.onSelect = (item: SelectItem) => done(item.value);
    selectList.onCancel = () => done(null);
    container.addChild(selectList);

    container.addChild(
      new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")),
    );
    container.addChild(
      new DynamicBorder((str: string) => theme.fg("accent", str)),
    );

    return {
      render(width: number) {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      },
      handleInput(data: string) {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });

  if (!result) return;

  if (result === "(none)") {
    activePresetName = undefined;
    activePreset = undefined;
    // Write default gateway
    pi.appendEntry(GATEWAY_ENTRY_TYPE, { gateway: "default" });
    ctx.ui.notify("Preset cleared", "info");
    updateStatus(ctx);
    return;
  }

  const preset = presets[result];
  if (preset) {
    await applyPreset(pi, result, preset, ctx);
    ctx.ui.notify(`Preset "${result}" activated`, "info");
    updateStatus(ctx);
  }
}

/**
 * Get active preset name (for external access).
 */
export function getActivePresetName(): string | undefined {
  return activePresetName;
}

/**
 * Get active preset (for external access).
 */
export function getActivePreset(): Preset | undefined {
  return activePreset;
}

/**
 * Setup all preset hooks.
 */
export function setupPresetHooks(pi: ExtensionAPI): void {
  // Register --preset CLI flag
  pi.registerFlag("preset", {
    description: "Preset configuration to use",
    type: "string",
  });

  // Register /preset command
  pi.registerCommand("preset", {
    description: "Switch preset configuration",
    handler: async (args, ctx) => {
      // If preset name provided, apply directly
      if (args?.trim()) {
        const name = args.trim();
        const preset = presets[name];
        if (!preset) {
          const available = Object.keys(presets).join(", ") || "(none defined)";
          ctx.ui.notify(
            `Unknown preset "${name}". Available: ${available}`,
            "error",
          );
          return;
        }
        await applyPreset(pi, name, preset, ctx);
        ctx.ui.notify(`Preset "${name}" activated`, "info");
        updateStatus(ctx);
        return;
      }

      // Otherwise show selector
      await showPresetSelector(pi, ctx);
    },
  });

  // Initialize on session start
  pi.on("session_start", async (_event, ctx) => {
    // Load presets from config files
    presets = loadPresets(ctx.cwd);

    // Check for --preset flag
    const presetFlag = pi.getFlag("preset");
    if (typeof presetFlag === "string" && presetFlag) {
      const preset = presets[presetFlag];
      if (preset) {
        await applyPreset(pi, presetFlag, preset, ctx);
        ctx.ui.notify(`Preset "${presetFlag}" activated`, "info");
      } else {
        const available = Object.keys(presets).join(", ") || "(none defined)";
        ctx.ui.notify(
          `Unknown preset "${presetFlag}". Available: ${available}`,
          "warning",
        );
      }
    }

    // Restore preset from session state (if no CLI flag)
    if (!presetFlag) {
      const entries = ctx.sessionManager.getEntries();
      const presetEntry = entries
        .filter(
          (e: { type: string; customType?: string }) =>
            e.type === "custom" && e.customType === STATE_ENTRY_TYPE,
        )
        .pop() as { data?: PresetStateEntry } | undefined;

      if (presetEntry?.data?.name) {
        const preset = presets[presetEntry.data.name];
        if (preset) {
          activePresetName = presetEntry.data.name;
          activePreset = preset;
          // Re-apply gateway on restore
          if (preset.gateway) {
            pi.appendEntry(GATEWAY_ENTRY_TYPE, { gateway: preset.gateway });
          }
        }
      }
    }

    updateStatus(ctx);
  });

  // Persist preset state on each turn
  pi.on("turn_start", async () => {
    if (activePresetName) {
      pi.appendEntry(STATE_ENTRY_TYPE, { name: activePresetName });
    }
  });
}
