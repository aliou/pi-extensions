import type {
  FixedWindowLimit,
  LimitViewModel,
  NormalizedLimit,
  RefillableLimit,
  RegenBudgetLimit,
} from "@harness/provider-usage";
import { formatCurrency, formatTimeRemaining } from "@harness/utils/formatters";
import { assessRisk, getPacePercent, getProjectedPercent } from "./engine";

function fixedWindowViewModel(limit: FixedWindowLimit): LimitViewModel {
  const pacePercent = getPacePercent(limit);
  const projectedPercent = getProjectedPercent(limit.usedPercent, pacePercent);
  const percent = Math.round(limit.usedPercent);

  const usageLabel =
    limit.capacity != null
      ? `${percent}%/${limit.capacity.toLocaleString()}`
      : `${percent}%`;

  return {
    id: limit.id,
    title: limit.scope ? `${limit.name} (${limit.scope})` : limit.name,
    usageLabel,
    usedPercent: limit.usedPercent,
    renewsLabel: limit.resetsAt
      ? `${formatTimeRemaining(limit.resetsAt)} remaining`
      : undefined,
    severity: "none",
    pacePercent,
    projectedPercent,
  };
}

function refillableViewModel(limit: RefillableLimit): LimitViewModel {
  const usedPercent =
    ((limit.capacity - limit.remaining) / limit.capacity) * 100;
  const percent = Math.round(usedPercent);
  return {
    id: limit.id,
    title: limit.name,
    subtitle: limit.limited ? "Limited" : undefined,
    usageLabel: `${percent}%/${limit.capacity.toLocaleString()}`,
    usedPercent,
    renewsLabel: `Next tick ${formatTimeRemaining(limit.nextRefillAt)}`,
    severity: "none",
    isRefillable: true,
  };
}

function budgetViewModel(limit: RegenBudgetLimit): LimitViewModel {
  const usedPercent =
    ((limit.maxAmountMinor - limit.remainingAmountMinor) /
      limit.maxAmountMinor) *
    100;
  const percent = Math.round(usedPercent);
  const usageLabel = `${percent}%/${formatCurrency(limit.maxAmountMinor, limit.currency)}`;

  let renewsLabel: string | undefined;
  if (limit.nextRegenAt) {
    const regenStr = limit.nextRegenAmountMinor
      ? `+${formatCurrency(limit.nextRegenAmountMinor, limit.currency)}`
      : "";
    renewsLabel =
      `${regenStr} in ${formatTimeRemaining(limit.nextRegenAt)}`.trim();
  }

  return {
    id: limit.id,
    title: limit.name,
    subtitle: limit.period,
    usageLabel,
    usedPercent,
    renewsLabel,
    severity: "none",
  };
}

/**
 * Builds a view model for a single limit. Runs risk assessment to set severity.
 */
export async function buildViewModel(
  limit: NormalizedLimit,
): Promise<LimitViewModel> {
  let vm: LimitViewModel;

  switch (limit.kind) {
    case "fixed-window":
      vm = fixedWindowViewModel(limit);
      break;
    case "refillable":
      vm = refillableViewModel(limit);
      break;
    case "regen-budget":
      vm = budgetViewModel(limit);
      break;
  }

  const risk = await assessRisk(limit);
  vm.severity = risk.severity;
  if (risk.reason) vm.message = risk.reason;
  if (risk.projectedPercent != null)
    vm.projectedPercent = risk.projectedPercent;
  if (risk.pacePercent != null) vm.pacePercent = risk.pacePercent;

  return vm;
}

/**
 * Builds view models for all limits in a snapshot.
 */
export async function buildViewModels(
  limits: NormalizedLimit[],
): Promise<LimitViewModel[]> {
  return Promise.all(limits.map(buildViewModel));
}
