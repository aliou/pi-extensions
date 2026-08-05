/**
 * In-process cooldowns for providers that just failed a subagent attempt.
 *
 * This is a temporary *eligibility* exclusion, not a ranking input: a cooled
 * provider is filtered out of the candidate list only while at least one
 * non-cooled candidate remains. It exists so repeated spawns stop re-probing a
 * provider that is out of budget or not answering; without it every spawn pays
 * a failed request (or a full startup window) before failing over.
 *
 * Scope is deliberately narrow: module-level, per process, shared across all
 * subagent types. Concurrent Pi processes each pay one probe per window.
 */

/** How long a provider stays excluded after a provider-scoped failure. */
export const PROVIDER_COOLDOWN_MS = 5 * 60_000;

export class ProviderCooldown {
  private failedAt = new Map<string, number>();

  constructor(
    private ttlMs: number = PROVIDER_COOLDOWN_MS,
    private now: () => number = () => Date.now(),
  ) {}

  /** Exclude `provider` from candidate lists for the cooldown window. */
  record(provider: string): void {
    this.failedAt.set(provider, this.now());
  }

  isCooled(provider: string): boolean {
    const at = this.failedAt.get(provider);
    if (at === undefined) return false;
    if (this.now() - at >= this.ttlMs) {
      this.failedAt.delete(provider);
      return false;
    }
    return true;
  }

  clear(): void {
    this.failedAt.clear();
  }
}

/** Process-wide cooldown map shared by every subagent. */
export const providerCooldown = new ProviderCooldown();
