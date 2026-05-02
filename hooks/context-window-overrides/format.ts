import type { DriftedContextWindowOverride } from "./drift";

export function formatContextWindowOverrideLines(
  drifted: DriftedContextWindowOverride[],
): string[] {
  return drifted.map(({ provider, modelId, current, desired }) => {
    const desiredStr = desired.toLocaleString();
    if (current === undefined) {
      return `  ${provider} / ${modelId}: missing (should be ${desiredStr})`;
    }
    return `  ${provider} / ${modelId}: ${current.toLocaleString()} → ${desiredStr}`;
  });
}
