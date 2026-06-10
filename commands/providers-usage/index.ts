import {
  BorderedLoader,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";
import { fetchAllProviders } from "@harness/provider-usage";
import { UsagePanel } from "./panel";

const REFRESH_TIMEOUT_MS = 10_000;

export default function providersUsageCommand(pi: ExtensionAPI): void {
  pi.registerCommand("providers:usage", {
    description: "Show provider usage dashboard",
    handler: async (_args, cmdCtx) => {
      if (!cmdCtx.hasUI) {
        cmdCtx.ui.notify("/providers:usage requires interactive mode", "error");
        return;
      }

      const activeProvider = cmdCtx.model?.provider;
      const authStorage = cmdCtx.modelRegistry?.authStorage;

      await cmdCtx.ui.custom((tui, theme, _kb, done) => {
        const loader = new BorderedLoader(tui, theme, "Loading usage...");
        loader.onAbort = () => done(undefined);

        let panel: UsagePanel | null = null;
        let refreshGen = 0;
        let pendingProviders = new Set<string>();
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;

        function loadData(): void {
          fetchAllProviders(loader.signal)
            .then((snapshots) => {
              if (loader.signal.aborted) return;
              panel = new UsagePanel(
                theme,
                snapshots,
                activeProvider,
                () => done(undefined),
                refreshPanel,
              );
              tui.requestRender();
            })
            .catch(() => {
              if (loader.signal.aborted) return;
              panel = new UsagePanel(
                theme,
                [],
                activeProvider,
                () => done(undefined),
                refreshPanel,
              );
              tui.requestRender();
            });
        }

        function finishProvider(gen: number, provider: string): void {
          if (gen !== refreshGen) return;
          if (!pendingProviders.delete(provider)) return;
          if (pendingProviders.size === 0) {
            if (refreshTimer) {
              clearTimeout(refreshTimer);
              refreshTimer = null;
            }
            loadData();
          }
        }

        function onRefreshTimeout(gen: number): void {
          if (gen !== refreshGen) return;
          pendingProviders.clear();
          refreshTimer = null;
          loadData();
        }

        // Listen for cache-updated events (fired after disk write completes).
        const offNeuralwatt = pi.events.on(
          "neuralwatt:usage-cache:updated",
          () => finishProvider(refreshGen, "neuralwatt"),
        );
        const offSynthetic = pi.events.on("synthetic:usage-cache:updated", () =>
          finishProvider(refreshGen, "synthetic"),
        );

        function refreshPanel(): void {
          panel = null;
          tui.requestRender();

          const gen = ++refreshGen;
          pendingProviders = new Set(["neuralwatt", "synthetic"]);

          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(
            () => onRefreshTimeout(gen),
            REFRESH_TIMEOUT_MS,
          );

          pi.events.emit("neuralwatt:quotas:request", { authStorage });
          pi.events.emit("synthetic:quotas:request", undefined);
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
          dispose: () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            offNeuralwatt();
            offSynthetic();
            loader.dispose();
          },
        };
      });
    },
  });

  const off = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    off();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "providers:usage",
      description: "usage dashboard",
    });
  });
}
