import type { ModelFamily } from "@/config/models";

export type SubagentName =
  | "oracle"
  | "scout"
  | "lookout"
  | "reviewer"
  | "worker"
  | "jester";

export type SubagentConfig = {
  name: SubagentName;
  prompt: {
    base: string[];
    byModelFamily?: Partial<Record<ModelFamily, string[]>>;
    byModelId?: Record<string, string[]>;
  };
  tools: {
    include: string[];
    exclude?: string[];
  };
};

export const SUBAGENT_CONFIGS: Record<SubagentName, SubagentConfig> = {
  oracle: {
    name: "oracle",
    prompt: { base: ["base.core"] },
    tools: { include: [] },
  },
  scout: {
    name: "scout",
    prompt: { base: ["base.core"] },
    tools: { include: [] },
  },
  lookout: {
    name: "lookout",
    prompt: { base: ["base.core"] },
    tools: { include: [] },
  },
  reviewer: {
    name: "reviewer",
    prompt: { base: ["base.core"] },
    tools: { include: [] },
  },
  worker: {
    name: "worker",
    prompt: { base: ["base.core"] },
    tools: { include: [] },
  },
  jester: {
    name: "jester",
    prompt: { base: ["base.core"] },
    tools: { include: [] },
  },
};
