import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const CODEX_FAST_ENTRY_TYPE = "providers-codex-fast";
export const DEFAULT_CODEX_FAST_MODE_ENABLED = true;

type FastModeState = {
  enabled?: boolean;
};

export function readCodexFastModeState(ctx: ExtensionContext): boolean {
  const entries = ctx.sessionManager.getEntries();

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "custom") continue;
    if (entry.customType !== CODEX_FAST_ENTRY_TYPE) continue;

    const data = entry.data as FastModeState | undefined;
    return data?.enabled === true;
  }

  return DEFAULT_CODEX_FAST_MODE_ENABLED;
}
