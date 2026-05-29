import type { ModelCandidate, ModelJob } from "./types";

const jobs = {
  "ad:small:text": [
    { provider: "neuralwatt", model: "kimi-k2.6-fast", thinking: "off" },
    { provider: "neuralwatt", model: "kimi-k2.5-fast", thinking: "off" },
    { provider: "neuralwatt", model: "glm-5-fast", thinking: "off" },
    { provider: "neuralwatt", model: "glm-5.1-fast", thinking: "off" },
    { provider: "synthetic", model: "moonshotai/Kimi-K2.6", thinking: "off" },
    {
      provider: "synthetic",
      model: "hf:zai-org/GLM-4.7-Flash",
      thinking: "off",
    },
    { provider: "openai-codex", model: "gpt-5.3-codex-spark", thinking: "off" },
    { provider: "openai-codex", model: "gpt-5.4-mini", thinking: "off" },
  ],
  "ad:large:text": [
    { provider: "openai-codex", model: "gpt-5.4", thinking: "medium" },
    { provider: "anthropic", model: "claude-sonnet-4-6", thinking: "medium" },
  ],
  "ad:small:vision": [
    { provider: "neuralwatt", model: "kimi-k2.6-fast", thinking: "off" },
    { provider: "neuralwatt", model: "qwen3.6-35b-fast", thinking: "off" },
    { provider: "synthetic", model: "moonshotai/Kimi-K2.6", thinking: "off" },
  ],
  "ad:large:vision": [
    { provider: "anthropic", model: "claude-opus-4-8", thinking: "medium" },
    { provider: "openai-codex", model: "gpt-5.4", thinking: "medium" },
  ],
  "ad:small:sota": [
    { provider: "openai-codex", model: "gpt-5.4-mini", thinking: "off" },
    { provider: "anthropic", model: "claude-haiku-latest", thinking: "off" },
  ],
  "ad:medium:sota": [
    { provider: "anthropic", model: "claude-sonnet-4-6", thinking: "medium" },
    {
      provider: "openrouter",
      model: "~anthropic/claude-sonnet-latest",
      thinking: "medium",
    },
    { provider: "openai-codex", model: "gpt-5.4", thinking: "low" },
  ],
  "ad:large:sota": [
    { provider: "openai-codex", model: "gpt-5.4", thinking: "medium" },
    { provider: "anthropic", model: "claude-opus-4-8", thinking: "medium" },
  ],
} satisfies Record<ModelJob, ModelCandidate[]>;

export function get(job: ModelJob): ModelCandidate[] {
  return jobs[job];
}

export default { get };
