import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createTool } from "./tool";

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createTool(pi));
}
