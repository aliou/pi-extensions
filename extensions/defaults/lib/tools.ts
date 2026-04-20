import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupBashTool } from "../tools/bash";
import { setupFindTool } from "../tools/find";
import { setupGrepTool } from "../tools/grep";
import { setupReadTool } from "../tools/read";

export function setupTools(pi: ExtensionAPI): void {
  setupReadTool(pi);
  setupFindTool(pi);
  setupGrepTool(pi);
  setupBashTool(pi);
}
