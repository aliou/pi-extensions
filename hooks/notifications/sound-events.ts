import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type AlertSound, playAlertSound } from "@harness/audio-player";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
  AD_NOTIFY_DONE_EVENT,
} from "@harness/events";

export function selectAlertSound(
  eventName: string,
  payload?: { status?: "ok" | "error" },
): AlertSound | undefined {
  if (eventName === AD_NOTIFY_ATTENTION_EVENT) return "attention";
  if (eventName === AD_NOTIFY_DANGEROUS_EVENT) return "attention";
  if (eventName === AD_NOTIFY_DONE_EVENT) {
    return payload?.status === "error" ? "error" : "success";
  }
  return undefined;
}

export function setupSoundEvents(
  pi: ExtensionAPI,
  prependBinaries: readonly string[] = [],
): () => void {
  const handler = (eventName: string) => (data: unknown) => {
    const payload = data as { status?: "ok" | "error" } | undefined;
    const sound = selectAlertSound(eventName, payload);
    if (!sound) return;
    void playAlertSound(pi.exec, sound, { prependBinaries });
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
