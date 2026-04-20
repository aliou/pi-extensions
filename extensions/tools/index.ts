import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupGetCurrentTimeTool } from "./get-current-time";
import { setupReadUrlTool } from "./read-url";

export default function (pi: ExtensionAPI) {
  setupGetCurrentTimeTool(pi);
  setupReadUrlTool(pi);
}
