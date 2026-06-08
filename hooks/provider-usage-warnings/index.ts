import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  fetchProvider,
  findHighRiskLimits,
  toProviderKey,
} from "@harness/provider-usage";
import { notificationLevel, ProviderUsageAlertTracker } from "./alerts";
import { formatProviderUsageWarning, pairRisksWithLimits } from "./format";

const alerts = new ProviderUsageAlertTracker();

async function checkProviderUsage(
  ctx: ExtensionContext,
  model: { provider: string } | undefined,
  skipAlreadyWarned: boolean,
): Promise<void> {
  if (!ctx.hasUI) return;

  const providerKey = toProviderKey(model?.provider);
  if (!providerKey) return;

  try {
    const snapshot = await fetchProvider(providerKey);
    const highRisks = await findHighRiskLimits(snapshot.limits);
    if (highRisks.length === 0) return;

    const toNotify = alerts.filterNotifiable(highRisks, skipAlreadyWarned);
    if (toNotify.length === 0) return;

    alerts.markAll(highRisks);

    const risksWithLimits = pairRisksWithLimits(snapshot.limits, toNotify);
    if (risksWithLimits.length === 0) return;

    ctx.ui.notify(
      formatProviderUsageWarning(snapshot.displayName, risksWithLimits),
      notificationLevel(toNotify),
    );
  } catch (_error) {
    void _error;
  }
}

function triggerProviderUsageCheck(
  ctx: ExtensionContext,
  model: { provider: string } | undefined,
  skipAlreadyWarned: boolean,
): void {
  checkProviderUsage(ctx, model, skipAlreadyWarned).catch(() => {});
}

export default function providerUsageWarningsHook(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    alerts.clear();
    triggerProviderUsageCheck(ctx, ctx.model, false);
  });

  pi.on("agent_end", async (_event, ctx) => {
    triggerProviderUsageCheck(ctx, ctx.model, true);
  });

  pi.on("model_select", async (event, ctx) => {
    alerts.clear();
    triggerProviderUsageCheck(ctx, event.model, false);
  });
}
