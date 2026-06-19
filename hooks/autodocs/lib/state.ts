/**
 * Autodocs state machine.
 *
 * Tracks the lifecycle of a docs-drift check so that overlapping git
 * advancements don't spawn multiple concurrent checks or stacked gates.
 * States:
 *   idle        -> nothing in flight
 *   checking    -> a check subagent is running
 *   gateOpen    -> the confirmation gate is being shown
 *   applying    -> an apply subagent is writing docs (/docs:update path)
 *
 * Transitions are guarded: a new advancement is dropped unless we are idle.
 * There is no debounce and no queue by design (git ops are infrequent).
 */

import type { GitAdvancement } from "./types";

export type AutodocsState = "idle" | "checking" | "gateOpen" | "applying";

interface AutodocsStateValue {
  state: AutodocsState;
  /** Advancement being checked, if any. */
  advancement: GitAdvancement | undefined;
}

const value: AutodocsStateValue = {
  state: "idle",
  advancement: undefined,
};

export function getState(): AutodocsState {
  return value.state;
}

export function isIdle(): boolean {
  return value.state === "idle";
}

/** Try to begin a check. Returns false if a check/gate/apply is in flight. */
export function beginCheck(advancement: GitAdvancement): boolean {
  if (value.state !== "idle") return false;
  value.state = "checking";
  value.advancement = advancement;
  return true;
}

/** Mark the check finished and ready to show a gate. */
export function openGate(): void {
  value.state = "gateOpen";
}

/** Mark the gate dismissed (accept or skip) and return to idle. */
export function closeGate(): void {
  value.state = "idle";
  value.advancement = undefined;
}

/** Try to begin an apply. Returns false unless idle or gate is open. */
export function beginApply(): boolean {
  if (value.state !== "idle" && value.state !== "gateOpen") return false;
  value.state = "applying";
  return true;
}

/** Mark the apply finished. */
export function endApply(): void {
  value.state = "idle";
  value.advancement = undefined;
}

/** Abort back to idle from any state (e.g. on error or session shutdown). */
export function reset(): void {
  value.state = "idle";
  value.advancement = undefined;
}
