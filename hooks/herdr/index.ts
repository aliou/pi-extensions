import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
  type AdNotifyAttentionEvent,
  type AdNotifyDangerousEvent,
} from "@harness/events";
import { buildCacheMetadata } from "./cache-metadata";
import { CACHE_REFRESH_INTERVAL_MS, getCacheFreshness } from "./cache-status";
import {
  createHerdrClientFromEnv,
  HERDR_CACHE_TOKEN,
  type HerdrClient,
} from "./lib/client";

function attentionBody(event: AdNotifyAttentionEvent): string {
  return event.description ?? event.reason ?? "Waiting for user input";
}

export function setupHerdrHook(pi: ExtensionAPI, client: HerdrClient): void {
  let activeContext: ExtensionContext | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const clearRefreshTimer = () => {
    if (!refreshTimer) return;
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  };

  const publishCache = (ctx: ExtensionContext) => {
    const metadata = buildCacheMetadata(
      getCacheFreshness(ctx.sessionManager.getBranch()),
      ctx.model
        ? { provider: ctx.model.provider, id: ctx.model.id }
        : undefined,
    );
    client.reportMetadata(
      { [HERDR_CACHE_TOKEN]: metadata.value },
      metadata.ttlMs,
    );
  };

  const scheduleRefresh = () => {
    clearRefreshTimer();
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      if (activeContext) publishCache(activeContext);
      scheduleRefresh();
    }, CACHE_REFRESH_INTERVAL_MS);
    refreshTimer.unref?.();
  };

  pi.on("session_start", (_event, ctx) => {
    if (ctx.hasUI !== true) return;
    activeContext = ctx;
    publishCache(ctx);
    scheduleRefresh();
  });

  pi.on("message_end", (event, ctx) => {
    if (
      ctx.hasUI !== true ||
      !activeContext ||
      event.message.role !== "assistant"
    )
      return;
    activeContext = ctx;
    publishCache(ctx);
  });

  const refreshCache = (ctx: ExtensionContext) => {
    if (ctx.hasUI !== true || !activeContext) return;
    activeContext = ctx;
    publishCache(ctx);
  };

  pi.on("model_select", (_event, ctx) => refreshCache(ctx));
  pi.on("session_compact", (_event, ctx) => refreshCache(ctx));
  pi.on("session_tree", (_event, ctx) => refreshCache(ctx));

  pi.events.on(AD_NOTIFY_ATTENTION_EVENT, (data: unknown) => {
    if (!activeContext) return;
    const event = data as AdNotifyAttentionEvent;
    client.showNotification({
      title: "Pi needs attention",
      body: attentionBody(event),
      sound: "request",
    });
  });

  pi.events.on(AD_NOTIFY_DANGEROUS_EVENT, (data: unknown) => {
    if (!activeContext) return;
    const event = data as AdNotifyDangerousEvent;
    client.showNotification({
      title: "Pi needs attention",
      body: `Dangerous command detected: ${event.description}`,
      sound: "request",
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.hasUI !== true) return;
    activeContext = undefined;
    clearRefreshTimer();
    client.close();
  });
}

export default function herdr(pi: ExtensionAPI): void {
  const client = createHerdrClientFromEnv();
  if (client) setupHerdrHook(pi, client);
}
