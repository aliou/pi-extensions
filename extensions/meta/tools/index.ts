import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupChangelogTool } from "./changelog-tool";
import { setupDocsTool } from "./docs-tool";
import { setupVersionTool } from "./version-tool";

export function setupMetaTools(pi: ExtensionAPI) {
  setupVersionTool(pi);
  setupDocsTool(pi);
  setupChangelogTool(pi);
}
