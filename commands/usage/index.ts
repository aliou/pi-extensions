import {
  BorderedLoader,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";
import {
  getApertureBaseUrl,
  setApertureBaseUrl,
} from "@harness/provider-usage";
import { UsagePanel } from "./panel";
import { loadUsageDashboard } from "./service";

/** Probe `${baseUrl}/v1/models` to confirm the gateway is reachable. */
async function isApertureReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return Array.isArray((body as { data?: unknown[] }).data);
  } catch {
    return false;
  }
}

/**
 * Ensure an Aperture base URL is configured. On first run (or if the stored
 * value is empty), prompts the user, validates it against `/v1/models`, and
 * persists it to `~/.pi/agent/extensions/provider-usage.json`.
 *
 * Returns the resolved base URL, or `undefined` if the user cancelled or the
 * endpoint is unreachable.
 */
async function ensureApertureBaseUrl(ui: {
  input: (title: string, placeholder?: string) => Promise<string | undefined>;
  notify: (message: string, type?: "info" | "warning" | "error") => void;
}): Promise<string | undefined> {
  const existing = getApertureBaseUrl();
  if (existing) return existing;

  const input = await ui.input(
    "Aperture base URL",
    "http://ai.<tailnet>.ts.net",
  );
  if (!input) return undefined;

  const baseUrl = input.trim().replace(/\/+$/, "");
  if (!baseUrl) return undefined;

  ui.notify(`Checking Aperture at ${baseUrl}...`, "info");
  const reachable = await isApertureReachable(baseUrl);
  if (!reachable) {
    ui.notify(
      `Could not reach Aperture at ${baseUrl}/v1/models. Check the URL and your tailnet connection.`,
      "error",
    );
    return undefined;
  }

  await setApertureBaseUrl(baseUrl);
  ui.notify(`Aperture configured: ${baseUrl}`, "info");
  return baseUrl;
}

export default function usageCommand(pi: ExtensionAPI): void {
  pi.registerCommand("usage", {
    description: "Show provider usage dashboard",
    handler: async (_args, cmdCtx) => {
      if (!cmdCtx.hasUI) {
        cmdCtx.ui.notify("/usage requires interactive mode", "error");
        return;
      }

      // Prompt for the Aperture base URL on first run and persist it. This
      // is best-effort: anthropic (Claude Code subscription) and openai-codex
      // don't need Aperture, so the dashboard still loads if the user skips or
      // the gateway is unreachable. synthetic/neuralwatt will just show as
      // failed snapshots until Aperture is configured.
      await ensureApertureBaseUrl(cmdCtx.ui);

      const activeProvider = cmdCtx.model?.provider;
      const authStorage = cmdCtx.modelRegistry?.authStorage;

      const result = await cmdCtx.ui.custom<"closed">(
        (tui, theme, _keybindings, done) => {
          const loader = new BorderedLoader(tui, theme, "Loading usage...");
          loader.onAbort = () => done("closed");

          let panel: UsagePanel | null = null;
          let forceRefresh = false;

          function loadData(): void {
            panel = null;
            tui.requestRender();
            loadUsageDashboard({
              authStorage,
              signal: loader.signal,
              forceRefresh,
            })
              .then((dashboard) => {
                if (loader.signal.aborted) return;
                forceRefresh = false;
                panel = new UsagePanel(
                  theme,
                  dashboard.snapshots,
                  activeProvider,
                  () => done("closed"),
                  refreshPanel,
                );
                tui.requestRender();
              })
              .catch(() => {
                if (loader.signal.aborted) return;
                forceRefresh = false;
                panel = new UsagePanel(
                  theme,
                  [],
                  activeProvider,
                  () => done("closed"),
                  refreshPanel,
                );
                tui.requestRender();
              });
          }

          function refreshPanel(): void {
            forceRefresh = true;
            loadData();
          }

          loadData();

          return {
            handleInput: (data: string) =>
              panel ? panel.handleInput(data) : loader.handleInput(data),
            render: (width: number) =>
              panel ? panel.render(width) : loader.render(width),
            invalidate: () => {
              panel?.invalidate();
              loader.invalidate();
            },
            dispose: () => loader.dispose(),
          };
        },
      );

      if (result === undefined) {
        cmdCtx.ui.notify("Usage dashboard requires interactive UI", "warning");
      }
    },
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "usage",
      description: "usage dashboard",
    });
  });
}
