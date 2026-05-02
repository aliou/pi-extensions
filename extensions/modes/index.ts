import {
  AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT,
  AD_EDITOR_READY_EVENT,
  AD_MODES_READY_EVENT,
} from "@harness/events";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerModeControls } from "./commands/mode-command";
import {
  setupContextFilterHook,
  setupSessionSyncHooks,
  setupSystemPromptHook,
  setupToolGateHook,
} from "./hooks";
import { applyMode } from "./lib/mode-lifecycle";
import { registerModeSwitchRenderer } from "./lib/mode-switch";
import { setupAppendSystemMdCheck } from "./lib/system-md-check";
import { getCurrentMode } from "./state";
import { setupSwitchModeTool } from "./tools/switch-mode";

export default async function (pi: ExtensionAPI): Promise<void> {
  pi.registerFlag("agent-mode", {
    description: "Starting modes extension mode",
    type: "string",
  });

  setupToolGateHook(pi);
  setupContextFilterHook(pi);
  setupSessionSyncHooks(pi);
  setupSystemPromptHook(pi);
  setupAppendSystemMdCheck(pi);

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
  setupSwitchModeTool(pi, applyMode);
  registerModeSwitchRenderer(pi);

  emitCurrentMode();
  pi.events.emit(AD_MODES_READY_EVENT, {});
}
