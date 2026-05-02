import { join } from "node:path";
import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { CONTEXT_WINDOW_OVERRIDES } from "./config";
import {
  applyContextWindowOverrides,
  collectDriftedContextWindowOverrides,
} from "./drift";
import { formatContextWindowOverrideLines } from "./format";
import { readModelsJson, writeModelsJson } from "./models-json";

export default function contextWindowOverrides(pi: ExtensionAPI): void {
  if (Object.keys(CONTEXT_WINDOW_OVERRIDES).length === 0) return;

  pi.on("session_start", async (event, ctx) => {
    // Only prompt on fresh starts, not resumes/switches
    if (event.reason !== "startup" && event.reason !== "new") return;

    const modelsJsonPath = join(getAgentDir(), "models.json");
    const config = readModelsJson(modelsJsonPath);
    const drifted = collectDriftedContextWindowOverrides(
      config,
      CONTEXT_WINDOW_OVERRIDES,
    );

    if (drifted.length === 0) return;

    const lines = formatContextWindowOverrideLines(drifted);

    ctx.ui.notify(
      "Context window overrides in models.json are out of date:\n" +
        lines.join("\n"),
      "warning",
    );
    pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
      description: "Context window overrides in models.json are out of date.",
    });

    const confirmed = await ctx.ui.confirm(
      "Update models.json?",
      `The following context window overrides will be written to models.json:\n${lines.join("\n")}`,
    );

    if (!confirmed) return;

    applyContextWindowOverrides(config, drifted);
    writeModelsJson(modelsJsonPath, config);
    ctx.modelRegistry.refresh();
    ctx.ui.notify(
      "models.json updated. Context window overrides applied.",
      "info",
    );
  });
}
