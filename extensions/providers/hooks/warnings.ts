import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { formatTimeRemaining } from "@harness/utils/formatters";
import { getProviderSettings } from "../config";
import { fetchProvider, toProviderKey } from "../lib/adapters";
import { findHighRiskLimits } from "../lib/engine";
import type { NormalizedLimit, RiskAssessment, Severity } from "../lib/types";

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

interface AlertState {
  lastSeverity: Severity;
  lastNotifiedAt: number;
}

const alerts = new Map<string, AlertState>();

function shouldNotify(limitId: string, severity: Severity): boolean {
  const state = alerts.get(limitId);
  if (!state) return true;

  // Severity escalation always notifies.
  const order: Severity[] = ["none", "warning", "high", "critical"];
  if (order.indexOf(severity) > order.indexOf(state.lastSeverity)) return true;

  // High/critical: always notify.
  if (severity === "high" || severity === "critical") return true;

  // Warning: only if cooldown elapsed.
  if (severity === "warning") {
    return Date.now() - state.lastNotifiedAt >= COOLDOWN_MS;
  }

  return false;
}

function markNotified(limitId: string, severity: Severity): void {
  alerts.set(limitId, { lastSeverity: severity, lastNotifiedAt: Date.now() });
}

function formatWarning(
  displayName: string,
  risks: Array<{ limit: NormalizedLimit; risk: RiskAssessment }>,
): string {
  const lines = risks.map(({ limit, risk }) => {
    const parts: string[] = [
      `- ${limit.scope ? `${limit.name} (${limit.scope})` : limit.name}`,
    ];

    if (limit.kind === "fixed-window") {
      parts.push(`${Math.round(limit.usedPercent)}% used`);
      if (risk.projectedPercent != null) {
        parts.push(`projected ${Math.round(risk.projectedPercent)}%`);
      }
    } else if (limit.kind === "refillable") {
      const pct = Math.round(
        ((limit.capacity - limit.remaining) / limit.capacity) * 100,
      );
      parts.push(`${pct}% used`);
      if (risk.minutesToExhaustion != null) {
        parts.push(`~${Math.round(risk.minutesToExhaustion)}m to exhaustion`);
      }
    } else if (limit.kind === "regen-budget") {
      const pct = Math.round(
        ((limit.maxAmountMinor - limit.remainingAmountMinor) /
          limit.maxAmountMinor) *
          100,
      );
      parts.push(`${pct}% used`);
    }

    if (risk.severity !== "none") {
      parts.push(`(${risk.severity})`);
    }

    // Add reset info.
    if (limit.kind === "fixed-window" && limit.resetsAt) {
      parts.push(`resets ${formatTimeRemaining(limit.resetsAt)}`);
    }

    return parts.join(", ");
  });

  return `${displayName} rate limit warning:\n${lines.join("\n")}`;
}

async function checkAndWarn(
  ctx: ExtensionContext,
  model: { provider: string } | undefined,
  skipAlreadyWarned: boolean,
): Promise<void> {
  if (!ctx.hasUI) return;

  const providerKey = toProviderKey(model?.provider);
  if (!providerKey) return;

  const settings = getProviderSettings(providerKey);
  if (!settings.warnings) return;

  try {
    const snapshot = await fetchProvider(
      providerKey,
      ctx.modelRegistry.authStorage,
    );
    if (!snapshot) return;

    const highRisks = await findHighRiskLimits(snapshot.limits);
    if (highRisks.length === 0) return;

    // Build limit lookup for formatting.
    const limitMap = new Map(snapshot.limits.map((l) => [l.id, l]));

    // Filter to notifiable risks.
    const toNotify = skipAlreadyWarned
      ? highRisks.filter((r) => shouldNotify(r.limitId, r.severity))
      : highRisks;

    if (toNotify.length === 0) return;

    // Mark all high-risk limits (not just notifiable ones) to track escalation.
    for (const r of highRisks) {
      markNotified(r.limitId, r.severity);
    }

    const risksWithLimits = toNotify
      .map((risk) => {
        const limit = limitMap.get(risk.limitId);
        return limit ? { limit, risk } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (risksWithLimits.length === 0) return;

    const message = formatWarning(snapshot.displayName, risksWithLimits);
    const hasCritical = toNotify.some((r) => r.severity === "critical");
    const hasHigh = toNotify.some((r) => r.severity === "high");
    const level = hasCritical || hasHigh ? "error" : "warning";

    ctx.ui.notify(message, level);
  } catch (_error) {
    void _error;
    // Silently ignore -- non-blocking.
  }
}

function triggerCheck(
  ctx: ExtensionContext,
  model: { provider: string } | undefined,
  skipAlreadyWarned: boolean,
): void {
  checkAndWarn(ctx, model, skipAlreadyWarned).catch(() => {});
}

export function setupWarningHooks(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    alerts.clear();
    triggerCheck(ctx, ctx.model, false);
  });

  pi.on("agent_end", async (_event, ctx) => {
    triggerCheck(ctx, ctx.model, true);
  });

  pi.on("model_select", async (event, ctx) => {
    alerts.clear();
    triggerCheck(ctx, event.model, false);
  });
}
