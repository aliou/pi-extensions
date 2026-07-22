import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { ProviderUsageSnapshot } from "@harness/provider-usage";
import { formatLastUpdated } from "./format";
import { renderProgressBar, severityColor } from "./progress";
import type { UsageQuotaView } from "./types";
import { buildQuotaViews } from "./view";

function renderQuotaBlock(
  vm: UsageQuotaView,
  width: number,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  const barWidth = Math.min(50, Math.max(20, width - 20));
  const color = severityColor(vm.severity);

  const titleParts = [theme.fg(vm.blocked ? "dim" : "accent", vm.title)];
  if (vm.subtitle) titleParts.push(theme.fg("dim", ` (${vm.subtitle})`));
  if (vm.blocked) titleParts.push(theme.fg("dim", " (blocked)"));
  lines.push(`  ${titleParts.join("")}`);

  if (vm.blocked) {
    lines.push(
      `  ${theme.fg("dim", "▒".repeat(barWidth))} ${theme.fg("dim", vm.usageLabel)}`,
    );
  } else {
    const bar = renderProgressBar(
      vm.usedPercent,
      barWidth,
      theme,
      color,
      vm.markerPercent,
      vm.pacePercent,
    );
    lines.push(`  ${bar} ${theme.fg(color, vm.usageLabel)}`);
  }

  const leftParts: string[] = [];
  const rightLabel = vm.renewsLabel ?? vm.expirationLabel;

  if (vm.usedPercent < 100) {
    if (vm.projectionLabel) {
      leftParts.push(
        vm.severity !== "none"
          ? theme.fg(color, vm.projectionLabel)
          : theme.fg("dim", vm.projectionLabel),
      );
    } else if (vm.projectedPercent != null && vm.projectedPercent > 0) {
      const projected = `proj ${Math.round(vm.projectedPercent)}%`;
      leftParts.push(
        vm.severity !== "none"
          ? theme.fg(color, projected)
          : theme.fg("dim", projected),
      );
    }
    if (vm.severity !== "none") leftParts.push(theme.fg(color, vm.severity));
    if (vm.message) leftParts.push(theme.fg("dim", vm.message));
  }

  const leftStr = leftParts.join("  ");
  const rightStr = rightLabel ? theme.fg("dim", rightLabel) : "";
  const gap = Math.max(
    2,
    barWidth - visibleWidth(leftStr) - visibleWidth(rightStr),
  );
  if (leftStr || rightStr)
    lines.push(`  ${leftStr}${" ".repeat(gap)}${rightStr}`);

  return lines;
}

export function buildProviderTab(
  snapshot: ProviderUsageSnapshot,
  width: number,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  const status = statusForSnapshot(snapshot);
  const isStale = Date.now() - snapshot.fetchedAt.getTime() > 60 * 60_000;
  const statusParts = [
    `Status: ${theme.fg(status.color, `● ${status.text}`)}`,
    `Last update: ${theme.fg(isStale ? "error" : "dim", formatLastUpdated(snapshot.fetchedAt))}`,
  ];
  lines.push(`  ${statusParts.join("   ")}`);
  lines.push("");

  for (const error of snapshot.errors ?? [])
    lines.push(theme.fg("error", `Error: ${error.message}`));
  if (snapshot.errors?.length) lines.push("");

  if (!snapshot.quotas.length) {
    lines.push(theme.fg("dim", "No rate limit data"));
    return trimBlankTail(lines);
  }

  const views = buildQuotaViews(snapshot);
  for (const view of views) {
    lines.push(...renderQuotaBlock(view, width, theme));
    lines.push("");
  }

  return trimBlankTail(lines);
}

function statusForSnapshot(snapshot: ProviderUsageSnapshot): {
  color: "success" | "warning" | "error" | "dim";
  text: string;
} {
  if (snapshot.errors?.length && !snapshot.quotas.length)
    return { color: "error", text: "Error" };
  if (snapshot.status?.blocked) return { color: "error", text: "Blocked" };
  if (snapshot.status?.limited) return { color: "warning", text: "Limited" };
  if (snapshot.status?.available === false)
    return { color: "error", text: "Unavailable" };
  if (snapshot.status?.available === true)
    return { color: "success", text: "Operational" };
  return { color: "dim", text: "Unknown" };
}

function trimBlankTail(lines: string[]): string[] {
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
