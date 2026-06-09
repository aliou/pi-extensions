// =============================================================================
// Normalized limit types -- shared across all providers
// =============================================================================

/** Base fields shared by all limit kinds. */
export type ProviderId =
  | "anthropic"
  | "openai-codex"
  | "synthetic"
  | "neuralwatt";

export interface BaseLimit {
  provider: ProviderId;
  /** Stable identifier, e.g. "anthropic:five-hour" or "codex:spark:secondary". */
  id: string;
  /** Human-readable name, e.g. "5-hour window". */
  name: string;
  /** Optional scope qualifier, e.g. model name like "GPT-5.3-Codex-Spark". */
  scope?: string;
  updatedAt: Date;
}

/** A window with a fixed capacity that resets fully at a specific time. */
export interface FixedWindowLimit extends BaseLimit {
  kind: "fixed-window";
  /** Total capacity (requests, tokens, etc). May be unknown for percent-only APIs. */
  capacity?: number;
  /** Amount used. */
  used?: number;
  /** Percent used (0-100). */
  usedPercent: number;
  /** When this window fully resets. */
  resetsAt: Date | null;
  /** Window duration in seconds. */
  windowSeconds?: number;
  /** Unit label for display (e.g. "req", "tokens"). */
  unit?: string;
}

/**
 * A bucket that continuously regenerates capacity over time via periodic ticks.
 * Example: Synthetic rolling 5h limit.
 */
export interface RefillableLimit extends BaseLimit {
  kind: "refillable";
  /** Maximum capacity. */
  capacity: number;
  /** Current remaining capacity. */
  remaining: number;
  /** Amount refilled per tick. */
  refillAmount: number;
  /** Milliseconds between ticks. */
  refillIntervalMs: number;
  /** When the next refill tick occurs. */
  nextRefillAt: Date;
  /** Whether the limit is currently reached. */
  limited: boolean;
}

/**
 * A budget (often dollar-denominated) that regenerates a fixed amount at
 * scheduled intervals. Example: Synthetic weekly credits, Claude extra usage.
 */
export interface RegenBudgetLimit extends BaseLimit {
  kind: "regen-budget";
  /** Currency code (e.g. "USD") or "Quota" for non-monetary. */
  currency: string;
  /** Maximum budget in minor units (cents). */
  maxAmountMinor: number;
  /** Remaining budget in minor units (cents). */
  remainingAmountMinor: number;
  /** Period label (e.g. "Monthly", "Weekly"). */
  period: string;
  /** When the next regeneration occurs. */
  nextRegenAt: Date | null;
  /** Amount regenerated in minor units (cents). */
  nextRegenAmountMinor: number | null;
}

export type NormalizedLimit =
  | FixedWindowLimit
  | RefillableLimit
  | RegenBudgetLimit;

// =============================================================================
// Provider snapshot -- result of fetching one provider
// =============================================================================

export type ProviderStatus = "operational" | "degraded" | "outage" | "unknown";

export interface ProviderSnapshot {
  provider: ProviderId;
  displayName: string;
  status: ProviderStatus;
  statusMessage?: string;
  limits: NormalizedLimit[];
  /** Plan name or type (e.g. "pro", "prolite"). */
  plan?: string;
  /** Codex credits metadata. */
  credits?: {
    hasCredits: boolean;
    unlimited: boolean;
    balance?: number;
  };
  /** True when the provider is currently in overage/extra-usage mode. */
  extraUsageActive?: boolean;
  error?: string;
  fetchedAt: Date;
}

// =============================================================================
// Risk assessment
// =============================================================================

export type Severity = "none" | "warning" | "high" | "critical";

export interface RiskAssessment {
  limitId: string;
  severity: Severity;
  /** Projected usage percent at end of window (fixed-window only). */
  projectedPercent?: number;
  /** Pace percent through window (fixed-window only). */
  pacePercent?: number;
  /** Minutes until projected exhaustion (refillable/budget). */
  minutesToExhaustion?: number;
  /** Whether refill rate offsets the burn rate. */
  refillOffsetsRisk?: boolean;
  /** Human-readable reason for the severity. */
  reason?: string;
}

// =============================================================================
// Threshold profiles
// =============================================================================

export interface FixedWindowThresholds {
  /** Minimum used% before any warning fires. */
  usedFloor: { start: number; end: number };
  warnProjected: { start: number; end: number };
  highProjected: { start: number; end: number };
  criticalProjected: { start: number; end: number };
}

export interface RefillableThresholds {
  /** Warn when remaining/capacity drops below this percent. */
  lowRemainingPercent: number;
  /** Warn when projected exhaustion is within this many minutes (net burn > 0). */
  exhaustionHorizonMin: number;
  /** Suppress projected warnings when net burn rate <= 0. */
  suppressIfNetBurnNonPositive: boolean;
}

export interface BudgetThresholds {
  warningPercent: number;
  criticalPercent: number;
  /** Absolute warning threshold in minor units. */
  warningAmountMinor: number;
  /** Absolute critical threshold in minor units. */
  criticalAmountMinor: number;
  /** Downgrade severity if regen is within this many minutes. */
  downgradeIfRegenWithinMin: number;
}

export interface ThresholdProfile {
  fixedWindow: FixedWindowThresholds;
  refillable: RefillableThresholds;
  budget: BudgetThresholds;
}

// =============================================================================
// View model -- presentation-ready data for the UI
// =============================================================================

export interface LimitViewModel {
  id: string;
  title: string;
  subtitle?: string;
  /** Formatted usage label, e.g. "42%/1750". */
  usageLabel: string;
  /** Used percent 0-100 for progress bars. */
  usedPercent: number;
  /** Formatted reset/renew label. */
  renewsLabel?: string;
  severity: Severity;
  /** Optional warning/info message. */
  message?: string;
  /** Pace percent for progress bar marker (period advancement). */
  pacePercent?: number | null;
  /** Projected percent for display. */
  projectedPercent?: number;
  /** True for refillable limits (suppresses projection display). */
  isRefillable?: boolean;
  /** Tick time-marker position (0-100) for progress bar. Distinct from pacePercent. */
  markerPercent?: number | null;
}

// =============================================================================
// History sample for burn rate estimation
// =============================================================================

export interface LimitSample {
  at: number; // epoch ms
  remaining: number;
}

export type LimitHistory = Record<string, LimitSample[]>;
