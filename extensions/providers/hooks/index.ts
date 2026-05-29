import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupWarningHooks } from "./warnings";

export function setupHooks(pi: ExtensionAPI): void {
  setupWarningHooks(pi);
}
