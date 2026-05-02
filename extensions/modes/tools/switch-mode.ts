import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "typebox";

import type { ApplyModeFn } from "../commands/mode-command";
import { MODE_ORDER, MODES } from "../modes";
import { getCurrentMode } from "../state";

const SwitchModeParams = Type.Object({
  mode: Type.String({
    description: `Target mode (${MODE_ORDER.join(", ")}).`,
  }),
});

type SwitchModeParamsType = Static<typeof SwitchModeParams>;

type SwitchModeDetails = {
  ok: boolean;
  from: string;
  to: string;
  message: string;
};

function emitSwitchModeGateEvent(
  pi: ExtensionAPI,
  description: string,
  from: string,
  to: string,
  toolCallId: string,
): void {
  pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
    source: "modes:switch-mode",
    description,
    reason: `${from} -> ${to}`,
    toolName: "switch_mode",
    toolCallId,
  });
}

function toResult(
  details: SwitchModeDetails,
): AgentToolResult<SwitchModeDetails> {
  return {
    content: [{ type: "text", text: details.message }],
    details,
  };
}

export function setupSwitchModeTool(
  pi: ExtensionAPI,
  applyMode: ApplyModeFn,
): void {
  pi.registerTool<typeof SwitchModeParams, SwitchModeDetails>({
    name: "switch_mode",
    label: "Switch Mode",
    description:
      "Switch agent mode to another mode. Always available, with explicit confirmation.",
    parameters: SwitchModeParams,

    async execute(
      toolCallId,
      params: SwitchModeParamsType,
      // unused: _signal, _onUpdate
      _signal,
      _onUpdate,
      ctx: ExtensionContext,
    ): Promise<AgentToolResult<SwitchModeDetails>> {
      const current = getCurrentMode().name;
      const requested = params.mode.trim();

      if (!requested || !MODES[requested]) {
        return toResult({
          ok: false,
          from: current,
          to: requested || current,
          message: `Unknown mode. Available: ${MODE_ORDER.join(", ")}`,
        });
      }

      if (requested === current) {
        return toResult({
          ok: true,
          from: current,
          to: requested,
          message: `Already in ${requested} mode.`,
        });
      }

      const description = `Confirmation required: switch mode from ${current} to ${requested}`;

      emitSwitchModeGateEvent(pi, description, current, requested, toolCallId);

      if (!ctx.hasUI) {
        return toResult({
          ok: false,
          from: current,
          to: requested,
          message:
            "Mode switch requires explicit confirmation, but no UI is available.",
        });
      }

      const confirmed = await ctx.ui.confirm(
        "Switch mode?",
        `Switch from ${current} to ${requested}?`,
      );

      if (!confirmed) {
        return toResult({
          ok: false,
          from: current,
          to: requested,
          message: "Blocked by user.",
        });
      }

      await applyMode(pi, ctx, requested, { persist: true });

      return toResult({
        ok: true,
        from: current,
        to: requested,
        message: `Switched from ${current} to ${requested} mode.`,
      });
    },

    renderCall(args: SwitchModeParamsType, theme: Theme): Text {
      const to = args.mode?.trim() || "<missing>";
      return new Text(
        `${theme.fg("dim", "[Switch Mode]")} ${theme.fg("accent", to)}`,
        0,
        0,
      );
    },

    renderResult(
      result: AgentToolResult<SwitchModeDetails>,
      _options: ToolRenderResultOptions,
      theme: Theme,
    ): Text {
      const details = result.details;
      if (!details) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" && text.text ? text.text : "No result",
          0,
          0,
        );
      }

      const status = details.ok
        ? theme.fg("success", "ok")
        : theme.fg("error", "blocked");
      return new Text(
        `${theme.fg("dim", "status:")} ${status}\n${details.message}`,
        0,
        0,
      );
    },
  });
}
