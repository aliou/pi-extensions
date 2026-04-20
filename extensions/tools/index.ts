import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAskUserTool } from "./ask-user";
import { setupGetCurrentTimeTool } from "./get-current-time";
import { setupReadUrlTool } from "./read-url";

export default function (pi: ExtensionAPI) {
  pi.registerTool(createAskUserTool(pi));
  setupGetCurrentTimeTool(pi);
  setupReadUrlTool(pi);
}
