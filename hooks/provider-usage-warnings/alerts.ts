import type { RiskAssessment, Severity } from "@harness/provider-usage";

const COOLDOWN_MS = 60 * 60 * 1000;
const SEVERITY_ORDER: Severity[] = ["none", "warning", "high", "critical"];

interface AlertState {
  lastSeverity: Severity;
  lastNotifiedAt: number;
}

export class ProviderUsageAlertTracker {
  private alerts = new Map<string, AlertState>();

  clear(): void {
    this.alerts.clear();
  }

  filterNotifiable(
    risks: RiskAssessment[],
    skipAlreadyWarned: boolean,
  ): RiskAssessment[] {
    if (!skipAlreadyWarned) return risks;
    return risks.filter((risk) => this.shouldNotify(risk));
  }

  markAll(risks: RiskAssessment[]): void {
    const now = Date.now();
    for (const risk of risks) {
      this.alerts.set(risk.limitId, {
        lastSeverity: risk.severity,
        lastNotifiedAt: now,
      });
    }
  }

  private shouldNotify(risk: RiskAssessment): boolean {
    const state = this.alerts.get(risk.limitId);
    if (!state) return true;

    if (
      SEVERITY_ORDER.indexOf(risk.severity) >
      SEVERITY_ORDER.indexOf(state.lastSeverity)
    ) {
      return true;
    }

    if (risk.severity === "high" || risk.severity === "critical") return true;

    if (risk.severity === "warning") {
      return Date.now() - state.lastNotifiedAt >= COOLDOWN_MS;
    }

    return false;
  }
}

export function notificationLevel(
  risks: RiskAssessment[],
): "warning" | "error" {
  return risks.some(
    (risk) => risk.severity === "critical" || risk.severity === "high",
  )
    ? "error"
    : "warning";
}
