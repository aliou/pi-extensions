/**
 * Standalone Gist entry point for notifications.
 *
 * Local harness installs use `index.ts`, which prefers the repository-built
 * `bin/play-alert-sound` helper. The standalone Gist cannot depend on that
 * repository-relative binary, so it uses the shared audio player with `afplay`.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupNotificationProducer } from "./producer";
import { setupSoundEvents } from "./sound-events";
import { setupTerminalConsumer } from "./terminal";

export default function (pi: ExtensionAPI): void {
  setupNotificationProducer(pi);

  const stopSound = setupSoundEvents(pi);
  const stopTerminal = setupTerminalConsumer(pi);

  pi.on("session_shutdown", () => {
    stopSound();
    stopTerminal();
  });
}
