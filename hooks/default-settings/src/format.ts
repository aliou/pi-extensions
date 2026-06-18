import type { DriftedModelOverride } from "./drift";

export function formatModelOverrideLines(
  drifted: DriftedModelOverride[],
): string[] {
  return drifted.map(({ provider, modelId, cost }) => {
    const parts: string[] = [];

    if (cost) {
      for (const [key, { current, desired }] of Object.entries(cost)) {
        parts.push(fmtField(`cost.${key}`, current, desired));
      }
    }

    return `- \`${provider}/${modelId}\`: ${parts.join(", ")}`;
  });
}

function fmtField(
  name: string,
  current: number | undefined,
  desired: number,
): string {
  return `${name} ${fmtValue(current)} -> ${fmtValue(desired)}`;
}

function fmtValue(value: number | undefined): string {
  return value === undefined ? "null" : value.toLocaleString();
}
