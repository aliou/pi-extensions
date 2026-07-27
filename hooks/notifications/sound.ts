/**
 * Sound consumer for harness notification events.
 *
 * Maps canonical `ad:notify:*` events to macOS alert sounds and plays them
 * via the native `play-alert-sound` binary. Visual delivery is handled
 * elsewhere; this module is intentionally independent of terminal state
 * (isTTY, HERDR_ENV, focus, etc.) so sounds are identical whether Pi runs
 * directly in Ghostty or inside Herdr.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
  AD_NOTIFY_DONE_EVENT,
} from "@harness/events";

// Path to the native binary (resolved relative to this file)
export const PLAY_ALERT_SOUND_BINARY = fileURLToPath(
  new URL("../../bin/play-alert-sound", import.meta.url),
);

const GLASS_SOUND = "/System/Library/Sounds/Glass.aiff";
const FUNK_SOUND = "/System/Library/Sounds/Funk.aiff";
const BASSO_SOUND = "/System/Library/Sounds/Basso.aiff";

/**
 * Choose the alert sound for a canonical notification event.
 */
export function selectSoundPath(
  eventName: string,
  payload?: { status?: "ok" | "error" },
): string | undefined {
  if (eventName === AD_NOTIFY_ATTENTION_EVENT) return GLASS_SOUND;
  if (eventName === AD_NOTIFY_DANGEROUS_EVENT) return GLASS_SOUND;
  if (eventName === AD_NOTIFY_DONE_EVENT) {
    return payload?.status === "error" ? BASSO_SOUND : FUNK_SOUND;
  }
  return undefined;
}

/**
 * Play a notification sound (macOS only, best-effort).
 */
export async function playSound(
  exec: ExtensionAPI["exec"],
  soundPath: string,
): Promise<void> {
  if (process.platform !== "darwin") return;
  if (!existsSync(PLAY_ALERT_SOUND_BINARY)) return;

  try {
    await exec(PLAY_ALERT_SOUND_BINARY, [soundPath]);
  } catch (_error) {
    void _error;
    // Sound playback failed — not worth alerting the user over.
  }
}

/**
 * Register the sound consumer. Each notification event results in exactly
 * one sound regardless of whether a visual banner is also produced.
 */
export function setupSoundConsumer(pi: ExtensionAPI): () => void {
  const handler = (eventName: string) => (data: unknown) => {
    const payload = data as { status?: "ok" | "error" } | undefined;
    const soundPath = selectSoundPath(eventName, payload);
    if (!soundPath) return;
    void playSound(pi.exec, soundPath);
  };

  const stopHandles: Array<() => void> = [];

  stopHandles.push(
    pi.events.on(AD_NOTIFY_ATTENTION_EVENT, handler(AD_NOTIFY_ATTENTION_EVENT)),
  );
  stopHandles.push(
    pi.events.on(AD_NOTIFY_DANGEROUS_EVENT, handler(AD_NOTIFY_DANGEROUS_EVENT)),
  );
  stopHandles.push(
    pi.events.on(AD_NOTIFY_DONE_EVENT, handler(AD_NOTIFY_DONE_EVENT)),
  );

  return () => {
    for (const stop of stopHandles) stop();
  };
}
