import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupSessionCommands } from "./commands";
import { setupProtectSessionsDirHook } from "./hooks/protect-sessions-dir";
import {
  setupSessionLinkMarkerRenderer,
  setupSessionLinkSourceRenderer,
} from "./lib/session-link";
import { setupSessionTools } from "./tools";

export default async function (pi: ExtensionAPI) {
  setupProtectSessionsDirHook(pi);
  setupSessionLinkMarkerRenderer(pi);
  setupSessionLinkSourceRenderer(pi);
  setupSessionTools(pi);
  setupSessionCommands(pi);
}
