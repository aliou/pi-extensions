import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createTool } from "./tool";

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createTool(pi));
}
