import {
  BorderedLoader,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";
import { UsagePanel } from "./panel";
import { loadUsageDashboard } from "./service";

export default function usageCommand(pi: ExtensionAPI): void {
  pi.registerCommand("usage", {
    description: "Show provider usage dashboard",
    handler: async (_args, cmdCtx) => {
      if (!cmdCtx.hasUI) {
        cmdCtx.ui.notify("/usage requires interactive mode", "error");
        return;
      }

      const activeProvider = cmdCtx.model?.provider;
      const authStorage = cmdCtx.modelRegistry?.authStorage;

      await cmdCtx.ui.custom((tui, theme, _keybindings, done) => {
        const loader = new BorderedLoader(tui, theme, "Loading usage...");
        loader.onAbort = () => done(undefined);

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
                () => done(undefined),
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
                () => done(undefined),
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
      });
    },
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "usage",
      description: "usage dashboard",
    });
  });
}
