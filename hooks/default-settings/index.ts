import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import {
  applyDefaultSettings,
  collectMissingEnabledModels,
  formatEnabledModelLines,
} from "./enabled-models";
import {
  CONTEXT_WINDOW_CLAMP,
  deriveContextWindowClampOverrides,
  EXPLICIT_MODEL_OVERRIDES,
  mergeModelOverrides,
} from "./model-overrides";
import { applyModelOverrides, collectDriftedModelOverrides } from "./src/drift";
import { formatModelOverrideLines } from "./src/format";
import { readModelsJson, writeModelsJson } from "./src/models-json";
import { readSettingsJson, writeSettingsJson } from "./src/settings-json";

export default function defaultSettings(pi: ExtensionAPI): void {
  pi.on("session_start", async (event, ctx) => {
    // Only prompt on fresh starts, not resumes/switches
    if (event.reason !== "startup" && event.reason !== "new") return;

    // Derive context-window clamps from the registry (covers every
    // auth-configured model whose context window exceeds the cap), merged
    // with any explicit hand-maintained overrides (e.g. pricing fixes).
    const registryModels = ctx.modelRegistry.getAvailable();
    const modelOverrides = mergeModelOverrides(
      deriveContextWindowClampOverrides(registryModels, CONTEXT_WINDOW_CLAMP),
      EXPLICIT_MODEL_OVERRIDES,
    );

    if (Object.keys(modelOverrides).length > 0) {
      const modelsJsonPath = join(getAgentDir(), "models.json");
      const config = readModelsJson(modelsJsonPath);
      const drifted = collectDriftedModelOverrides(config, modelOverrides);

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
          applyModelOverrides(config, modelOverrides);
          writeModelsJson(modelsJsonPath, config);
          ctx.modelRegistry.refresh();
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
