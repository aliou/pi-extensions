import { configLoader as breadcrumbsConfigLoader } from "@extensions/breadcrumbs/config";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { applyMode } from "@modes/lib/mode-lifecycle";
import { createAskUserTool } from "@/tools/ask-user";
import { setupBashTool } from "@/tools/bash";
import { setupFindTool } from "@/tools/find";
import { setupFindSessionsTool } from "@/tools/find-sessions";
import { setupGetCurrentTimeTool } from "@/tools/get-current-time";
import { setupHandoffTool } from "@/tools/handoff";
import { setupListSessionsTool } from "@/tools/list-sessions";
import { setupSwitchModeTool } from "@/tools/mode.switch";
import { setupReadTool } from "@/tools/read";
import { setupReadSessionTool } from "@/tools/read-session";
import { setupReadUrlTool } from "@/tools/read-url";

export async function setupRootTools(pi: ExtensionAPI): Promise<void> {
  await breadcrumbsConfigLoader.load();
  const breadcrumbsConfig = breadcrumbsConfigLoader.getConfig();

  setupReadTool(pi);
  setupFindTool(pi);
  setupBashTool(pi);
  setupGetCurrentTimeTool(pi);
  setupReadUrlTool(pi);

  setupFindSessionsTool(pi);
  setupListSessionsTool(pi);
  setupReadSessionTool(pi);
  if (breadcrumbsConfig.handoffTool) {
    setupHandoffTool(pi);
  }

  pi.registerTool(createAskUserTool(pi));
  setupSwitchModeTool(pi, applyMode);
}
