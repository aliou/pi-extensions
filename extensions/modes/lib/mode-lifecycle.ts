import { AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT } from "@harness/events";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { ModeSpec } from "../modes";
import { DEFAULT_MODE, MODE_ORDER, MODES } from "../modes";
import {
  clearSessionAllowedTools,
  getCurrentMode,
  getPendingModeState,
  setCurrentMode,
  setPendingModeState,
} from "../state";
import { sendModeSwitchMessage } from "./mode-switch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToolsForMode(mode: ModeSpec, allToolNames: string[]): string[] {
  return mode.allowedTools.length === 0 && mode.gatedTools.length === 0
    ? allToolNames
    : [...mode.allowedTools, ...mode.gatedTools];
}

function resolveModelId(
  mode: ModeSpec | undefined,
  ctx: ExtensionContext,
): string | undefined {
  if (mode?.provider && mode.model) {
    return ctx.modelRegistry.find(mode.provider, mode.model)?.id ?? mode.model;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// applyMode
// ---------------------------------------------------------------------------

export interface ApplyModeOptions {
  /** Don't show mode-switch message. Used for internal restores. */
  silent?: boolean;
  /** Force apply even if already in this mode (sets model, thinking, tools). */
  force?: boolean;
  /**
   * Persist mode-state to branch immediately.
   * true = persist now (agent switches via switch_mode tool).
   * false/undefined = defer until next turn boundary (user switches via Ctrl+U, /mode).
   */
  persist?: boolean;
}

export async function applyMode(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  modeName: string,
  options?: ApplyModeOptions,
): Promise<void> {
  const mode = MODES[modeName];
  if (!mode) {
    ctx.ui.notify(`Unknown mode. Available: ${MODE_ORDER.join(", ")}`, "error");
    return;
  }

  const previousModeName = getCurrentMode().name;
  const sameMode = previousModeName === modeName;

  // Apply tools regardless of whether the mode changed.
  clearSessionAllowedTools();
  pi.setActiveTools(
    getToolsForMode(
      mode,
      pi.getAllTools().map((t) => t.name),
    ),
  );

  // When already in this mode, only re-apply if forced.
  if (sameMode && !options?.force) {
    return;
  }

  setCurrentMode(mode);

  if (mode.thinkingLevel) {
    pi.setThinkingLevel(mode.thinkingLevel);
  }

  const targetModelId = resolveModelId(mode, ctx);

  if (!options?.silent) {
    if (options?.persist) {
      pi.appendEntry("mode-state", { mode: modeName });
    } else {
      setPendingModeState(modeName);
    }
    sendModeSwitchMessage(
      pi,
      { mode: modeName, from: previousModeName, model: targetModelId },
      `Switched to ${modeName.toUpperCase()} mode.`,
    );
  }

  // Update border decoration before async model switch.
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

  if (mode.provider && mode.model) {
    const found = ctx.modelRegistry.find(mode.provider, mode.model);
    if (found) {
      await pi.setModel(found);
    } else {
      ctx.ui.notify(
        `Model ${mode.provider}/${mode.model} not found`,
        "warning",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Pending state flush
// ---------------------------------------------------------------------------

/** Flush deferred mode-state to the branch. Called at turn boundaries. */
export function flushPendingModeState(pi: ExtensionAPI): void {
  const pending = getPendingModeState();
  if (pending !== null) {
    setPendingModeState(null);
    pi.appendEntry("mode-state", { mode: pending });
  }
}

// ---------------------------------------------------------------------------
// Branch restore
// ---------------------------------------------------------------------------

export function getLastModeFromBranch(ctx: ExtensionContext): string | null {
  const entries = ctx.sessionManager.getBranch() as Array<{
    type?: string;
    customType?: string;
    data?: { mode?: unknown };
  }>;

  const last = entries
    .filter(
      (entry) => entry.type === "custom" && entry.customType === "mode-state",
    )
    .at(-1);

  const mode = last?.data?.mode;
  return typeof mode === "string" ? mode : null;
}

function isNewSession(
  reason: string | undefined,
  ctx: ExtensionContext,
): boolean {
  if (reason !== "startup" && reason !== "new") return false;
  const branch = ctx.sessionManager.getBranch() as Array<{ type?: string }>;
  return !branch.some((e) => e.type === "message");
}

// ---------------------------------------------------------------------------
// Session restore
// ---------------------------------------------------------------------------

export async function restoreModeForSession(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  honorFlagOverride: boolean,
  reason?: string,
): Promise<void> {
  const restored = getLastModeFromBranch(ctx);
  const baseMode = restored ?? DEFAULT_MODE.name;
  const from = getCurrentMode().name;

  await applyMode(pi, ctx, baseMode, {
    silent: true,
    force: isNewSession(reason, ctx),
  });

  if (from !== baseMode && restored) {
    const mode = MODES[baseMode];
    sendModeSwitchMessage(
      pi,
      { mode: baseMode, from, model: resolveModelId(mode, ctx) },
      `Restored ${baseMode.toUpperCase()} mode.`,
    );
  }

  if (honorFlagOverride) {
    const modeFlag = pi.getFlag("agent-mode");
    if (typeof modeFlag === "string" && modeFlag.trim()) {
      const requested = modeFlag.trim();
      const fromFlag = getCurrentMode().name;
      await applyMode(pi, ctx, requested, { silent: true, persist: false });
      if (fromFlag !== requested) {
        const mode = MODES[requested];
        sendModeSwitchMessage(
          pi,
          { mode: requested, from: fromFlag, model: resolveModelId(mode, ctx) },
          `Flag set ${requested.toUpperCase()} mode.`,
        );
      }
    }
  }
}
