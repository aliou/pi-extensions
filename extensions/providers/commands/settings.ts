import {
  registerSettingsCommand,
  type SettingsSection,
} from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PROVIDER_KEYS } from "@harness/provider-usage";
import {
  configLoader,
  PROVIDER_DISPLAY_NAMES,
  type ProvidersConfig,
  type ResolvedConfig,
} from "../config";

export function registerProvidersSettings(pi: ExtensionAPI): void {
  registerSettingsCommand<ProvidersConfig, ResolvedConfig>(pi, {
    commandName: "providers:settings",
    commandDescription: "Configure providers extension settings",
    title: "Providers Settings",
    configStore: configLoader,
    buildSections: (
      tabConfig: ProvidersConfig | null,
      resolved: ResolvedConfig,
    ): SettingsSection[] => {
      const sections: SettingsSection[] = [];

      sections.push({
        label: "General",
        items: [
          {
            id: "refreshIntervalMinutes",
            label: "Refresh interval",
            description:
              "Minutes between rate limit checks (checked on events, not a timer)",
            currentValue: String(
              tabConfig?.refreshIntervalMinutes ??
                resolved.refreshIntervalMinutes,
            ),
            values: ["1", "5", "10", "15", "30"],
          },
        ],
      });

      for (const key of PROVIDER_KEYS) {
        const displayName = PROVIDER_DISPLAY_NAMES[key];
        const providerResolved = resolved.providers[key];
        const providerConfig = tabConfig?.providers?.[key];
        if (!providerResolved) continue;

        sections.push({
          label: displayName,
          items: [
            {
              id: `providers.${key}.warnings`,
              label: "Warnings",
              description: "Show rate limit warning notifications",
              currentValue:
                (providerConfig?.warnings ?? providerResolved.warnings)
                  ? "enabled"
                  : "disabled",
              values: ["enabled", "disabled"],
            },
          ],
        });
      }

      return sections;
    },
    onSettingChange: (
      id: string,
      newValue: string,
      config: ProvidersConfig,
    ): ProvidersConfig | null => {
      const updated = structuredClone(config);

      if (id === "refreshIntervalMinutes") {
        const num = Number.parseInt(newValue, 10);
        if (Number.isFinite(num) && num > 0) {
          updated.refreshIntervalMinutes = num;
        }
        return updated;
      }

      const match = id.match(/^providers\.(.+)\.(\w+)$/);
      if (match) {
        const providerKey = match[1] as string;
        const field = match[2] as string;

        if (!updated.providers) updated.providers = {};
        if (!updated.providers[providerKey])
          updated.providers[providerKey] = {};

        if (field === "warnings") {
          updated.providers[providerKey].warnings = newValue === "enabled";
        }

        return updated;
      }

      return null;
    },
  });
}
