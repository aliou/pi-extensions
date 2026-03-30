import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerModeControls } from "@modes/commands/mode-command";
import { configLoader } from "@modes/config";
import {
  setupContextFilterHook,
  setupSessionSyncHooks,
  setupSystemPromptHook,
  setupToolGateHook,
} from "@modes/hooks";
import { applyMode } from "@modes/lib/mode-lifecycle";
import { registerModeSwitchRenderer } from "@modes/lib/mode-switch";
import { getCurrentMode } from "@modes/state";
import {
  AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT,
  AD_EDITOR_READY_EVENT,
  AD_MODES_READY_EVENT,
} from "@packages/events";

export default async function (pi: ExtensionAPI): Promise<void> {
  await configLoader.load();
  pi.registerFlag("agent-mode", {
    description: "Starting modes extension mode",
    type: "string",
  });

  setupToolGateHook(pi);
  setupContextFilterHook(pi);
  setupSessionSyncHooks(pi);
  setupSystemPromptHook(pi);

  const emitCurrentMode = () => {
    const mode = getCurrentMode();
    pi.events.emit(AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT, {
      source: "modes",
      writes: [
        {
          kind: "slot",
          slot: "top-start",
          text: mode.label,
        },
        {
          kind: "band",
          band: "top",
          color: mode.labelColor,
        },
        {
          kind: "band",
          band: "bottom",
          color: mode.labelColor,
        },
      ],
    });
  };

  pi.events.on(AD_EDITOR_READY_EVENT, () => {
    emitCurrentMode();
  });

  registerModeControls(pi, applyMode);
  registerModeSwitchRenderer(pi);

  emitCurrentMode();
  pi.events.emit(AD_MODES_READY_EVENT, {});
}
