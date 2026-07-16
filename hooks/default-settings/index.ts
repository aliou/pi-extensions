import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import {
  applyDefaultSettings,
  collectMissingEnabledModels,
  formatEnabledModelLines,
} from "./enabled-models";
import { MODEL_OVERRIDES } from "./model-overrides";
import { applyModelOverrides, collectDriftedModelOverrides } from "./src/drift";
import { formatModelOverrideLines } from "./src/format";
import { readModelsJson, writeModelsJson } from "./src/models-json";
import { readSettingsJson, writeSettingsJson } from "./src/settings-json";

export default function defaultSettings(pi: ExtensionAPI): void {
  pi.on("session_start", async (event, ctx) => {
    // Only prompt on fresh starts, not resumes/switches
    if (event.reason !== "startup" && event.reason !== "new") return;

    if (Object.keys(MODEL_OVERRIDES).length > 0) {
      const modelsJsonPath = join(getAgentDir(), "models.json");
      const config = readModelsJson(modelsJsonPath);
      const drifted = collectDriftedModelOverrides(config, MODEL_OVERRIDES);

      if (drifted.length > 0) {
        const lines = formatModelOverrideLines(drifted);

        const message = [
          "### Sync models.json?",
          "",
          "The following overrides will be added to `models.json`:",
          ...lines,
        ].join("\n");

        const confirmed = await ctx.ui.confirm("Sync models.json?", message);

        if (confirmed) {
          applyModelOverrides(config, MODEL_OVERRIDES);
          writeModelsJson(modelsJsonPath, config);
          await ctx.modelRegistry.refresh();
          ctx.ui.notify(
            "models.json updated. Model overrides applied.",
            "info",
          );
        } else {
          ctx.ui.notify(
            `Model overrides in models.json are out of date:\n${lines.join("\n")}`,
            "warning",
          );
          pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
            description: "Model overrides in models.json are out of date.",
          });
        }
      }
    }

    const settingsJsonPath = join(getAgentDir(), "settings.json");
    const settings = readSettingsJson(settingsJsonPath);
    const missingModels = collectMissingEnabledModels(settings);

    if (missingModels.length === 0) return;

    const lines = formatEnabledModelLines(missingModels);

    const message = [
      "### Update settings.json?",
      "",
      "The following models will be added to `enabledModels`:",
      ...lines,
    ].join("\n");

    const confirmed = await ctx.ui.confirm("Update settings.json?", message);

    if (!confirmed) {
      ctx.ui.notify(
        `Default settings in settings.json are out of date:\n${lines.join("\n")}`,
        "warning",
      );
      pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, {
        description: "Default settings in settings.json are out of date.",
      });
      return;
    }

    applyDefaultSettings(settings);
    writeSettingsJson(settingsJsonPath, settings);
    ctx.ui.notify("settings.json updated. Default settings applied.", "info");
  });
}
