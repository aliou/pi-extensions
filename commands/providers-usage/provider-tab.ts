import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import {
  buildViewModels,
  getSeverityColor,
  type LimitViewModel,
  type NormalizedLimit,
  type ProviderSnapshot,
} from "@harness/provider-usage";
import { formatLastUpdated, renderProgressBar } from "./utils";

function renderLimitBlock(
  vm: LimitViewModel,
  width: number,
  theme: Theme,
  locked?: boolean,
): string[] {
  const lines: string[] = [];
  const barWidth = Math.min(50, Math.max(20, width - 20));
  const color = getSeverityColor(vm.severity);

  const titleParts = [theme.fg(locked ? "dim" : "accent", vm.title)];
  if (vm.subtitle) titleParts.push(theme.fg("dim", ` (${vm.subtitle})`));
  if (locked) titleParts.push(theme.fg("dim", " (blocked)"));
  lines.push(`  ${titleParts.join("")}`);

  if (locked) {
    const lockedBar = theme.fg("dim", "\u2592".repeat(barWidth));
    lines.push(`  ${lockedBar} ${theme.fg("dim", vm.usageLabel)}`);
  } else {
    const bar = renderProgressBar(
      vm.usedPercent,
      barWidth,
      theme,
      color,
      vm.pacePercent,
    );
    lines.push(`  ${bar} ${theme.fg(color, vm.usageLabel)}`);
  }

  if (locked) return lines;

  const leftParts: string[] = [];
  if (
    vm.projectedPercent != null &&
    vm.projectedPercent > 0 &&
    !vm.isRefillable
  ) {
    const projStr = `proj ${Math.round(vm.projectedPercent)}%`;
    leftParts.push(
      vm.severity !== "none"
        ? theme.fg(color, projStr)
        : theme.fg("dim", projStr),
    );
  }
  if (vm.message) leftParts.push(theme.fg("dim", vm.message));

  const leftStr = leftParts.join("  ");
  const rightStr = vm.renewsLabel ? theme.fg("dim", vm.renewsLabel) : "";
  const gap = Math.max(
    2,
    barWidth - visibleWidth(leftStr) - visibleWidth(rightStr),
  );
  if (leftStr || rightStr)
    lines.push(`  ${leftStr}${" ".repeat(gap)}${rightStr}`);

  return lines;
}

function findFullWeeklyScopes(limits: NormalizedLimit[]): Set<string> {
  const scopes = new Set<string>();
  for (const limit of limits) {
    if (limit.kind !== "fixed-window") continue;
    const ws = limit.windowSeconds ?? 0;
    if (ws >= 6 * 24 * 60 * 60 && limit.usedPercent >= 100) {
      scopes.add(limit.scope ?? "");
    }
  }
  return scopes;
}

function is5hWindow(limit: NormalizedLimit): boolean {
  if (limit.kind !== "fixed-window") return false;
  const ws = limit.windowSeconds ?? 0;
  return ws > 0 && ws <= 6 * 60 * 60;
}

export async function buildProviderTab(
  snapshot: ProviderSnapshot,
  width: number,
  theme: Theme,
): Promise<string[]> {
  const lines: string[] = [];

  let statusColor: "success" | "warning" | "error" | "dim" = "dim";
  let statusText = "Unknown";
  switch (snapshot.status) {
    case "operational":
      statusColor = "success";
      statusText = "Operational";
      break;
    case "degraded":
      statusColor = "warning";
      statusText = "Degraded";
      break;
    case "outage":
      statusColor = "error";
      statusText = "Outage";
      break;
  }

  const isStale = Date.now() - snapshot.fetchedAt.getTime() > 60 * 60_000;
  lines.push(
    `  Status: ${theme.fg(statusColor, `\u25cf ${statusText}`)}   Last update: ${theme.fg(isStale ? "error" : "dim", formatLastUpdated(snapshot.fetchedAt))}`,
  );
  lines.push("");

  if (snapshot.error) {
    lines.push(theme.fg("error", `Error: ${snapshot.error}`));
    return lines;
  }

  if (!snapshot.limits.length) {
    lines.push(theme.fg("dim", "No rate limit data"));
    return lines;
  }

  const fullWeeklyScopes = findFullWeeklyScopes(snapshot.limits);
  const viewModels = await buildViewModels(snapshot.limits);

  for (let i = 0; i < viewModels.length; i++) {
    const vm = viewModels[i];
    if (!vm) continue;
    const limit = snapshot.limits[i];
    const locked =
      limit && is5hWindow(limit) && fullWeeklyScopes.has(limit.scope ?? "");
    lines.push(...renderLimitBlock(vm, width, theme, locked));
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
