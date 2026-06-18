import type { ModelGroupId, ModelPreference, ModelRosters } from "./types";

const openAiCodexQuotaRefs = (model: string, aliases: string[] = []) => [
  { kind: "provider" as const },
  {
    kind: "model" as const,
    scopes: [model, ...aliases],
    ids: [model, ...aliases].flatMap((id) => [
      `${id}.primary_window`,
      `${id}.secondary_window`,
    ]),
  },
];

const anthropicQuotaRefs = (scope: string) => [
  { kind: "provider" as const },
  { kind: "model" as const, scopes: [scope] },
];

export const groups = {
  utilityText: "ad:utility:text",
  sessionRead: "ad:session:read",
  codebaseLocal: "ad:codebase:local",
  codebaseRemote: "ad:codebase:remote",
  reviewDiff: "ad:review:diff",
  advisorTechnical: "ad:advisor:technical",
  advisorDesign: "ad:advisor:design",
  visionInspect: "ad:vision:inspect",
} as const satisfies Record<string, ModelGroupId>;

export const defaultModelRosters = {
  "ad:utility:text": [
    {
      provider: "openai-codex",
      model: "gpt-5.3-codex-spark",
      thinking: "off",
      quotaRefs: openAiCodexQuotaRefs("gpt-5.3-codex-spark", [
        "spark",
        "codex-spark",
      ]),
    },
    {
      provider: "synthetic",
      model: "hf:zai-org/GLM-4.7-Flash",
      thinking: "off",
    },
    { provider: "neuralwatt", model: "glm-5.2-fast", thinking: "off" },
  ],
  "ad:session:read": [
    {
      provider: "synthetic",
      model: "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
      thinking: "off",
    },
    {
      provider: "synthetic",
      model: "hf:zai-org/GLM-4.7-Flash",
      thinking: "off",
    },
    { provider: "neuralwatt", model: "glm-5.2-fast", thinking: "off" },
    { provider: "neuralwatt", model: "kimi-k2.6-fast", thinking: "off" },
    { provider: "neuralwatt", model: "qwen3.5-397b", thinking: "medium" },
  ],
  "ad:codebase:local": [
    {
      provider: "neuralwatt",
      model: "kimi-k2.7-code",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:moonshotai/Kimi-K2.6",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:Qwen/Qwen3.5-397B-A17B",
      thinking: "medium",
    },
    { provider: "neuralwatt", model: "kimi-k2.6", thinking: "medium" },
    { provider: "neuralwatt", model: "qwen3.5-397b", thinking: "medium" },
    {
      provider: "openai-codex",
      model: "gpt-5.4-mini",
      thinking: "low",
      quotaRefs: openAiCodexQuotaRefs("gpt-5.4-mini"),
    },
  ],
  "ad:codebase:remote": [
    {
      provider: "neuralwatt",
      model: "kimi-k2.7-code",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:MiniMaxAI/MiniMax-M3",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:Qwen/Qwen3.5-397B-A17B",
      thinking: "medium",
    },
    { provider: "neuralwatt", model: "kimi-k2.6", thinking: "medium" },
    { provider: "neuralwatt", model: "qwen3.5-397b", thinking: "medium" },
  ],
  "ad:review:diff": [
    {
      provider: "neuralwatt",
      model: "kimi-k2.7-code",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:MiniMaxAI/MiniMax-M3",
      thinking: "medium",
    },
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      thinking: "medium",
      quotaRefs: anthropicQuotaRefs("sonnet"),
    },
    {
      provider: "openai-codex",
      model: "gpt-5.5",
      thinking: "low",
      quotaRefs: openAiCodexQuotaRefs("gpt-5.5"),
    },
    { provider: "neuralwatt", model: "qwen3.5-397b", thinking: "medium" },
  ],
  "ad:advisor:technical": [
    {
      provider: "openai-codex",
      model: "gpt-5.5",
      thinking: "medium",
      quotaRefs: openAiCodexQuotaRefs("gpt-5.5"),
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-8",
      thinking: "medium",
      quotaRefs: anthropicQuotaRefs("opus"),
    },
    {
      provider: "synthetic",
      model: "hf:MiniMaxAI/MiniMax-M3",
      thinking: "medium",
    },
    {
      provider: "neuralwatt",
      model: "kimi-k2.7-code",
      thinking: "medium",
    },
    { provider: "neuralwatt", model: "glm-5.1", thinking: "medium" },
    { provider: "neuralwatt", model: "kimi-k2.6", thinking: "medium" },
  ],
  "ad:advisor:design": [
    {
      provider: "anthropic",
      model: "claude-opus-4-8",
      thinking: "medium",
      quotaRefs: anthropicQuotaRefs("opus"),
    },
    {
      provider: "synthetic",
      model: "hf:MiniMaxAI/MiniMax-M3",
      thinking: "medium",
    },
    { provider: "neuralwatt", model: "kimi-k2.6", thinking: "medium" },
    { provider: "neuralwatt", model: "qwen3.5-397b", thinking: "medium" },
    {
      provider: "neuralwatt",
      model: "kimi-k2.7-code",
      thinking: "medium",
    },
  ],
  "ad:vision:inspect": [
    {
      provider: "synthetic",
      model: "hf:moonshotai/Kimi-K2.6",
      thinking: "off",
    },
    { provider: "neuralwatt", model: "kimi-k2.6-fast", thinking: "off" },
    { provider: "neuralwatt", model: "qwen3.6-35b-fast", thinking: "off" },
    {
      provider: "neuralwatt",
      model: "kimi-k2.7-code",
      thinking: "medium",
    },
    {
      provider: "openai-codex",
      model: "gpt-5.4-mini",
      thinking: "off",
      quotaRefs: openAiCodexQuotaRefs("gpt-5.4-mini"),
    },
  ],
} satisfies ModelRosters;

export function rosterFor(group: ModelGroupId): readonly ModelPreference[] {
  return defaultModelRosters[group];
}
