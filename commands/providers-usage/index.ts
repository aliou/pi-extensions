import {
  BorderedLoader,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { fetchAllProviders } from "@harness/provider-usage";
import { UsagePanel } from "./panel";

export default function providersUsageCommand(pi: ExtensionAPI): void {
  pi.registerCommand("providers:usage", {
    description: "Show provider usage dashboard",
    handler: async (_args, cmdCtx) => {
      if (!cmdCtx.hasUI) {
        cmdCtx.ui.notify("/providers:usage requires interactive mode", "error");
        return;
      }

      const activeProvider = cmdCtx.model?.provider;

      await cmdCtx.ui.custom((tui, theme, _kb, done) => {
        const loader = new BorderedLoader(tui, theme, "Loading usage...");
        loader.onAbort = () => done(undefined);

        let panel: UsagePanel | null = null;

        function refreshPanel(): void {
          panel = null;
          tui.requestRender();
          loadData();
        }

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
}
