import type { DriftedModelOverride } from "./drift";

export function formatModelOverrideLines(
  drifted: DriftedModelOverride[],
): string[] {
  return drifted.map(({ provider, modelId, contextWindow, cost }) => {
    const parts: string[] = [];
    const label = `${provider} / ${modelId}`;

    if (contextWindow) {
      parts.push(
        fmtField(
          "contextWindow",
          contextWindow.current,
          contextWindow.desired,
          (v) => v.toLocaleString(),
        ),
      );
    }

    if (cost) {
      const costParts = Object.entries(cost).map(
        ([key, { current, desired }]) => fmtCostPart(key, current, desired),
      );
      parts.push(costParts.join(", "));
    }

    return `  ${label}: ${parts.join("; ")}`;
  });
}

function fmtField(
  name: string,
  current: number | undefined,
  desired: number,
  fmt: (v: number) => string,
): string {
  if (current === undefined) {
    return `${name} missing (should be ${fmt(desired)})`;
  }
  return `${name} ${fmt(current)} → ${fmt(desired)}`;
}

function fmtCostPart(
  key: string,
  current: number | undefined,
  desired: number,
): string {
  const prefix = `${key} `;
  if (current === undefined) {
    return `${prefix}$${desired}`;
  }
  return `${prefix}$${current} → $${desired}`;
}
