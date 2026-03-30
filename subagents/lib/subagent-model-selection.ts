import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  getSubagentModelConfig,
  type SubagentModelCandidate,
  type SubagentName,
} from "@subagents/config";
import { resolveModel } from "@subagents/lib/model-resolver";

const selectedBySession = new Map<SubagentName, SubagentModelCandidate>();

export function clearSubagentModelSelections(): void {
  selectedBySession.clear();
}

function buildAttemptOrder(
  candidates: SubagentModelCandidate[],
): SubagentModelCandidate[] {
  if (candidates.length <= 1) return [...candidates];

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const randomCandidate = candidates[randomIndex];
  if (!randomCandidate) return [...candidates];

  return [
    randomCandidate,
    ...candidates.filter((_, index) => index !== randomIndex),
  ];
}

export function selectModelForSubagent(
  name: SubagentName,
  ctx: ExtensionContext,
): ReturnType<typeof resolveModel> {
  const config = getSubagentModelConfig(name);
  const candidates = config.candidates;

  if (!candidates || candidates.length === 0) {
    throw new Error(`No configured model candidates for subagent "${name}".`);
  }

  const cached = selectedBySession.get(name);
  if (cached) {
    try {
      return resolveModel(cached.provider, cached.model, ctx);
    } catch {
      selectedBySession.delete(name);
    }
  }

  const attempts = buildAttemptOrder(candidates);
  const errors: string[] = [];

  for (const candidate of attempts) {
    try {
      const model = resolveModel(candidate.provider, candidate.model, ctx);
      selectedBySession.set(name, candidate);
      return model;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate.provider}/${candidate.model}: ${message}`);
    }
  }

  throw new Error(
    `No available models for subagent "${name}". Tried ${attempts.length} candidate(s):\n- ${errors.join("\n- ")}`,
  );
}
