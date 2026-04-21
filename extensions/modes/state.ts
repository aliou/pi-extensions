import type { ModeSpec } from "./modes";
import { DEFAULT_MODE } from "./modes";

let currentMode: ModeSpec = DEFAULT_MODE;
const sessionAllowedTools: Set<string> = new Set();

/** Pending mode-state to persist on next turn boundary. */
let pendingModeState: string | null = null;

export function getCurrentMode(): ModeSpec {
  return currentMode;
}

export function setCurrentMode(mode: ModeSpec): void {
  currentMode = mode;
}

export function getSessionAllowedTools(): Set<string> {
  return sessionAllowedTools;
}

export function clearSessionAllowedTools(): void {
  sessionAllowedTools.clear();
}

export function addSessionAllowedTool(toolName: string): void {
  sessionAllowedTools.add(toolName);
}

export function getPendingModeState(): string | null {
  return pendingModeState;
}

export function setPendingModeState(modeName: string | null): void {
  pendingModeState = modeName;
}
