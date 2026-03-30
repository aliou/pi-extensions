import type { ModelFamily } from "@/config/models";

export type ModeName = "default" | "research";

export type ModePromptLayers = {
  base: string[];
  byModelFamily?: Partial<Record<ModelFamily, string[]>>;
  byModelId?: Record<string, string[]>;
};

export type ModeToolSelection = {
  include: string[];
  exclude?: string[];
};

export type ModeConfig = {
  name: ModeName;
  defaultProvider?: string;
  defaultModel?: string;
  prompt: ModePromptLayers;
  tools: ModeToolSelection;
};

export const MODE_CONFIGS: Record<ModeName, ModeConfig> = {
  default: {
    name: "default",
    prompt: {
      base: ["base.core", "mode.default"],
    },
    tools: {
      include: [],
    },
  },
  research: {
    name: "research",
    prompt: {
      base: ["base.core", "mode.research"],
      byModelFamily: {
        claude: ["family.claude"],
        gpt: ["family.gpt"],
      },
    },
    tools: {
      include: [],
    },
  },
};
