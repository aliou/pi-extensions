import {
  registerSettingsCommand,
  type SettingsSection,
} from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  configLoader,
  type ResolvedSubagentsConfig,
  SCOUT_WEB_FETCH_PROVIDERS,
  SCOUT_WEB_SEARCH_PROVIDERS,
  SUBAGENT_NAMES,
  type SubagentName,
  type SubagentsConfig,
} from "@subagents/config";

const SUBAGENT_UI: Record<
  SubagentName,
  { label: string; description: string }
> = {
  scout: {
    label: "Scout",
    description: "Web research and GitHub codebase exploration",
  },
  lookout: {
    label: "Lookout",
    description: "Local codebase search by functionality/concept",
  },
  oracle: {
    label: "Oracle",
    description: "Expert AI advisor for complex reasoning",
  },
  reviewer: {
    label: "Reviewer",
    description: "Code review feedback on diffs",
  },
  jester: {
    label: "Jester",
    description: "Random data generator",
  },
  worker: {
    label: "Worker",
    description:
      "Focused implementation agent with mandatory lint/typecheck/test verification",
  },
};

function parseCsvOrder(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function registerSubagentsSettings(pi: ExtensionAPI): void {
  registerSettingsCommand<SubagentsConfig, ResolvedSubagentsConfig>(pi, {
    commandName: "subagents:settings",
    commandDescription: "Configure subagent toggles and scout web routing",
    title: "Subagents Settings",
    configStore: configLoader,
    buildSections: (
      tabConfig: SubagentsConfig | null,
      resolved: ResolvedSubagentsConfig,
    ): SettingsSection[] => {
      const generalSection: SettingsSection = {
        label: "General",
        items: [
          {
            id: "debug",
            label: "Debug logging",
            description:
              "Write raw events to debug.jsonl for each subagent run",
            currentValue:
              (tabConfig?.debug ?? resolved.debug) ? "enabled" : "disabled",
            values: ["enabled", "disabled"],
          },
        ],
      };

      const subagentSections = SUBAGENT_NAMES.map((name) => {
        const ui = SUBAGENT_UI[name];
        const currentEnabled =
          tabConfig?.subagents?.[name]?.enabled ??
          resolved.subagents[name].enabled;

        const baseSection: SettingsSection = {
          label: `${ui.label} - ${ui.description}`,
          items: [
            {
              id: `subagents.${name}.enabled`,
              label: "Enabled",
              description: `Enable or disable ${ui.label}`,
              currentValue: currentEnabled ? "enabled" : "disabled",
              values: ["enabled", "disabled"],
            },
          ],
        };

        if (name !== "scout") return baseSection;

        const scoutWeb = resolved.subagents.scout.web;
        const scoutWebTab = tabConfig?.subagents?.scout?.web;

        baseSection.items.push(
          {
            id: "subagents.scout.web.searchOrder",
            label: "Search order",
            description: "CSV order, first provider tried first",
            currentValue: (
              scoutWebTab?.searchOrder ??
              scoutWeb?.searchOrder ??
              []
            ).join(","),
            values: [
              "exa,linkup,synthetic",
              "exa,synthetic,linkup",
              "synthetic,exa,linkup",
            ],
          },
          {
            id: "subagents.scout.web.fetchOrder",
            label: "Fetch order",
            description: "CSV order, first provider tried first",
            currentValue: (
              scoutWebTab?.fetchOrder ??
              scoutWeb?.fetchOrder ??
              []
            ).join(","),
            values: [
              "markdownDotNew,exa,linkup",
              "exa,markdownDotNew,linkup",
              "exa,linkup,markdownDotNew",
            ],
          },
          {
            id: "subagents.scout.web.providers.exa.enabled",
            label: "Exa enabled",
            description: "Enable Exa for search/fetch",
            currentValue:
              (scoutWebTab?.providers?.exa?.enabled ??
              scoutWeb?.providers.exa.enabled)
                ? "enabled"
                : "disabled",
            values: ["enabled", "disabled"],
          },
          {
            id: "subagents.scout.web.providers.linkup.enabled",
            label: "Linkup enabled",
            description: "Enable Linkup for search/fetch",
            currentValue:
              (scoutWebTab?.providers?.linkup?.enabled ??
              scoutWeb?.providers.linkup.enabled)
                ? "enabled"
                : "disabled",
            values: ["enabled", "disabled"],
          },
          {
            id: "subagents.scout.web.providers.markdownDotNew.enabled",
            label: "Markdown New enabled",
            description:
              "Enable Markdown New for web fetch (free, 500 req/day/IP)",
            currentValue:
              (scoutWebTab?.providers?.markdownDotNew?.enabled ??
              scoutWeb?.providers.markdownDotNew.enabled)
                ? "enabled"
                : "disabled",
            values: ["enabled", "disabled"],
          },
          {
            id: "subagents.scout.web.providers.synthetic.enabled",
            label: "Synthetic enabled",
            description: "Enable Synthetic for web search",
            currentValue:
              (scoutWebTab?.providers?.synthetic?.enabled ??
              scoutWeb?.providers.synthetic.enabled)
                ? "enabled"
                : "disabled",
            values: ["enabled", "disabled"],
          },
          {
            id: "subagents.scout.web.providers.exa.searchMode",
            label: "Exa search mode",
            description: "Exa /search mode",
            currentValue:
              scoutWebTab?.providers?.exa?.searchMode ??
              scoutWeb?.providers.exa.searchMode ??
              "auto",
            values: ["auto", "fast", "deep", "instant"],
          },
          {
            id: "subagents.scout.web.providers.linkup.searchDepth",
            label: "Linkup depth",
            description: "Linkup /search depth",
            currentValue:
              scoutWebTab?.providers?.linkup?.searchDepth ??
              scoutWeb?.providers.linkup.searchDepth ??
              "fast",
            values: ["standard", "deep", "fast"],
          },
          {
            id: "subagents.scout.web.providers.linkup.renderJsDefault",
            label: "Linkup render JS",
            description: "Default renderJs for Linkup fetch",
            currentValue:
              (scoutWebTab?.providers?.linkup?.renderJsDefault ??
              scoutWeb?.providers.linkup.renderJsDefault)
                ? "enabled"
                : "disabled",
            values: ["enabled", "disabled"],
          },
        );

        return baseSection;
      });

      return [generalSection, ...subagentSections];
    },
    onSettingChange: (
      id: string,
      newValue: string,
      config: SubagentsConfig,
    ): SubagentsConfig | null => {
      const updated = structuredClone(config);

      if (id === "debug") {
        updated.debug = newValue === "enabled";
        return updated;
      }

      if (!updated.subagents) updated.subagents = {};

      const parts = id.split(".");
      if (parts[0] !== "subagents") return null;

      if (parts.length === 3) {
        const name = parts[1] as SubagentName;
        const field = parts[2] as "enabled";

        const existing = updated.subagents[name] ?? {};
        updated.subagents[name] = existing;

        if (field === "enabled") {
          existing.enabled = newValue === "enabled";
          return updated;
        }

        return null;
      }

      if (parts[1] !== "scout") return null;
      if (!updated.subagents.scout) {
        updated.subagents.scout = {};
      }
      const scout = updated.subagents.scout;
      if (!scout.web) {
        scout.web = {};
      }
      const web = scout.web;

      if (id === "subagents.scout.web.searchOrder") {
        const values = parseCsvOrder(newValue).filter((p) =>
          SCOUT_WEB_SEARCH_PROVIDERS.includes(
            p as (typeof SCOUT_WEB_SEARCH_PROVIDERS)[number],
          ),
        ) as (typeof SCOUT_WEB_SEARCH_PROVIDERS)[number][];
        if (values.length > 0) web.searchOrder = values;
        return updated;
      }

      if (id === "subagents.scout.web.fetchOrder") {
        const values = parseCsvOrder(newValue).filter((p) =>
          SCOUT_WEB_FETCH_PROVIDERS.includes(
            p as (typeof SCOUT_WEB_FETCH_PROVIDERS)[number],
          ),
        ) as (typeof SCOUT_WEB_FETCH_PROVIDERS)[number][];
        if (values.length > 0) web.fetchOrder = values;
        return updated;
      }

      if (!web.providers) {
        web.providers = {};
      }
      if (!web.providers.exa) {
        web.providers.exa = {};
      }
      if (!web.providers.linkup) {
        web.providers.linkup = {};
      }
      if (!web.providers.synthetic) {
        web.providers.synthetic = {};
      }
      if (!web.providers.markdownDotNew) {
        web.providers.markdownDotNew = {};
      }

      const exa = web.providers.exa;
      const linkup = web.providers.linkup;
      const synthetic = web.providers.synthetic;
      const markdownDotNew = web.providers.markdownDotNew;

      if (id === "subagents.scout.web.providers.exa.enabled") {
        exa.enabled = newValue === "enabled";
        return updated;
      }

      if (id === "subagents.scout.web.providers.linkup.enabled") {
        linkup.enabled = newValue === "enabled";
        return updated;
      }

      if (id === "subagents.scout.web.providers.synthetic.enabled") {
        synthetic.enabled = newValue === "enabled";
        return updated;
      }

      if (id === "subagents.scout.web.providers.markdownDotNew.enabled") {
        markdownDotNew.enabled = newValue === "enabled";
        return updated;
      }

      if (id === "subagents.scout.web.providers.exa.searchMode") {
        exa.searchMode = newValue as "auto" | "fast" | "deep" | "instant";
        return updated;
      }

      if (id === "subagents.scout.web.providers.linkup.searchDepth") {
        linkup.searchDepth = newValue as "standard" | "deep" | "fast";
        return updated;
      }

      if (id === "subagents.scout.web.providers.linkup.renderJsDefault") {
        linkup.renderJsDefault = newValue === "enabled";
        return updated;
      }

      return null;
    },
  });
}
