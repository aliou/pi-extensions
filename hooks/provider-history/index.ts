import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  fetchProvider,
  recordSnapshotSamples,
  toProviderKey,
} from "@harness/provider-usage";

async function recordCurrentProvider(
  ctx: ExtensionContext,
  model: { provider?: string | null } | undefined,
): Promise<void> {
  const providerKey = toProviderKey(model?.provider);
  if (!providerKey) return;

  const snapshot = await fetchProvider(
    providerKey,
    ctx.modelRegistry.authStorage,
  );
  if (snapshot.error || snapshot.limits.length === 0) return;

  await recordSnapshotSamples(snapshot.limits);
}

function triggerRecord(
  ctx: ExtensionContext,
  model: { provider?: string | null } | undefined,
): void {
  recordCurrentProvider(ctx, model).catch(() => {});
}

export default function providerHistoryHook(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    triggerRecord(ctx, ctx.model);
  });

  pi.on("agent_end", async (_event, ctx) => {
    triggerRecord(ctx, ctx.model);
  });

  pi.on("model_select", async (event, ctx) => {
    triggerRecord(ctx, event.model);
  });
}
