import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupSessionCommands } from "./commands";
import { configLoader } from "./config";
import { setupPaletteRegistration } from "./hooks/palette";
import { setupProtectSessionsDirHook } from "./hooks/protect-sessions-dir";
import {
  setupSessionLinkMarkerRenderer,
  setupSessionLinkSourceRenderer,
} from "./lib/session-link";

export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  setupProtectSessionsDirHook(pi);
  setupSessionLinkMarkerRenderer(pi);
  setupSessionLinkSourceRenderer(pi);
  setupSessionCommands(pi);
  setupPaletteRegistration(pi);
}
