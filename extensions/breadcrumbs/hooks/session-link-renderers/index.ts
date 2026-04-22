import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  setupSessionLinkMarkerRenderer,
  setupSessionLinkSourceRenderer,
} from "../../lib/session-link";

export default async function (pi: ExtensionAPI) {
  setupSessionLinkMarkerRenderer(pi);
  setupSessionLinkSourceRenderer(pi);
}
