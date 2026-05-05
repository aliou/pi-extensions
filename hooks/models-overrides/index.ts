import { join } from "node:path";
import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { MODEL_OVERRIDES } from "./config";
import { applyModelOverrides, collectDriftedModelOverrides } from "./drift";
import { formatModelOverrideLines } from "./format";
import { readModelsJson, writeModelsJson } from "./models-json";

export default function modelsOverrides(pi: ExtensionAPI): void {
  if (Object.keys(MODEL_OVERRIDES).length === 0) return;

  pi.on("session_start", async (event, ctx) => {
    // Only prompt on fresh starts, not resumes/switches
    if (event.reason !== "startup" && event.reason !== "new") return;

    const modelsJsonPath = join(getAgentDir(), "models.json");
    const config = readModelsJson(modelsJsonPath);
    const drifted = collectDriftedModelOverrides(config, MODEL_OVERRIDES);

    if (drifted.length === 0) return;

    const lines = formatModelOverrideLines(drifted);

    ctx.ui.notify(
      `Model overrides in models.json are out of date:\n${lines.join("\n")}`,
      "warning",
    );
    pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
      description: "Model overrides in models.json are out of date.",
    });

    const confirmed = await ctx.ui.confirm(
      "Update models.json?",
      `The following model overrides will be written to models.json:\n${lines.join("\n")}`,
    );

    if (!confirmed) return;

    applyModelOverrides(config, MODEL_OVERRIDES);
    writeModelsJson(modelsJsonPath, config);
    ctx.modelRegistry.refresh();
    ctx.ui.notify("models.json updated. Model overrides applied.", "info");
  });
}
