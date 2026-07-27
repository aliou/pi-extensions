/**
 * Notification extension entry point.
 *
 * Wires three separate concerns:
 *
 * - `producer`   – emits canonical `ad:notify:*` events
 * - `terminal`   – writes OSC sequences (visual delivery)
 * - `sound`      – plays macOS alert sounds (audible delivery)
 *
 * Producer and consumers are independent. `hooks/herdr` and any other
 * consumers can subscribe to the same canonical events without change.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupNotificationProducer } from "./producer";
import { setupSoundConsumer } from "./sound";
import { setupTerminalConsumer } from "./terminal";

export default function (pi: ExtensionAPI): void {
  setupNotificationProducer(pi);

  const stopSound = setupSoundConsumer(pi);
  const stopTerminal = setupTerminalConsumer(pi);

  pi.on("session_shutdown", () => {
    stopSound();
    stopTerminal();
  });
}
