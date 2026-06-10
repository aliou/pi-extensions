import type { ModelCandidate, ModelJob } from "./types";

export const jobs = {
  "ad:small:text": [
    { provider: "neuralwatt", model: "glm-5.1-fast", thinking: "off" },
    { provider: "neuralwatt", model: "glm-5-fast", thinking: "off" },
    {
      provider: "synthetic",
      model: "hf:zai-org/GLM-4.7-Flash",
      thinking: "off",
    },
    {
      provider: "synthetic",
      model: "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
      thinking: "off",
    },
    { provider: "openai-codex", model: "gpt-5.3-codex-spark", thinking: "off" },
  ],
  "ad:large:text": [
    { provider: "neuralwatt", model: "kimi-k2.6", thinking: "low" },
    {
      provider: "synthetic",
      model: "hf:moonshotai/Kimi-K2.6",
      thinking: "low",
    },
    {
      provider: "neuralwatt",
      model: "qwen3.5-397b",
      thinking: "low",
    },
    {
      provider: "synthetic",
      model: "hf:Qwen/Qwen3.5-397B-A17B",
      thinking: "low",
    },
    { provider: "openai-codex", model: "gpt-5.4-mini", thinking: "low" },
  ],
  "ad:small:vision": [
    { provider: "neuralwatt", model: "kimi-k2.6-fast", thinking: "off" },
    { provider: "neuralwatt", model: "qwen3.6-35b-fast", thinking: "off" },
    {
      provider: "synthetic",
      model: "hf:moonshotai/Kimi-K2.6",
      thinking: "off",
    },
    {
      provider: "neuralwatt",
      model: "qwen3.6-35b",
      thinking: "off",
    },
    {
      provider: "synthetic",
      model: "hf:Qwen/Qwen3.6-27B",
      thinking: "off",
    },
    { provider: "openai-codex", model: "gpt-5.4-mini", thinking: "off" },
  ],
  "ad:large:vision": [
    { provider: "openai-codex", model: "gpt-5.5", thinking: "medium" },
    { provider: "anthropic", model: "claude-opus-4-8", thinking: "medium" },
    {
      provider: "neuralwatt",
      model: "kimi-k2.6",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:moonshotai/Kimi-K2.6",
      thinking: "medium",
    },
  ],
  "ad:small:sota": [
    { provider: "openai-codex", model: "gpt-5.5", thinking: "low" },
    { provider: "anthropic", model: "claude-haiku-4-5", thinking: "low" },
    { provider: "neuralwatt", model: "kimi-k2.6", thinking: "low" },
    {
      provider: "synthetic",
      model: "hf:moonshotai/Kimi-K2.6",
      thinking: "low",
    },
  ],
  "ad:medium:sota": [
    { provider: "anthropic", model: "claude-sonnet-4-6", thinking: "medium" },
    { provider: "openai-codex", model: "gpt-5.5", thinking: "low" },
    { provider: "neuralwatt", model: "glm-5.1", thinking: "low" },
    {
      provider: "synthetic",
      model: "hf:zai-org/GLM-5.1",
      thinking: "low",
    },
  ],
  "ad:large:sota": [
    { provider: "openai-codex", model: "gpt-5.5", thinking: "medium" },
    { provider: "anthropic", model: "claude-opus-4-8", thinking: "medium" },
    {
      provider: "neuralwatt",
      model: "glm-5.1",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:zai-org/GLM-5.1",
      thinking: "medium",
    },
    {
      provider: "neuralwatt",
      model: "kimi-k2.6",
      thinking: "medium",
    },
    {
      provider: "synthetic",
      model: "hf:moonshotai/Kimi-K2.6",
      thinking: "medium",
    },
  ],
} satisfies Record<ModelJob, ModelCandidate[]>;
