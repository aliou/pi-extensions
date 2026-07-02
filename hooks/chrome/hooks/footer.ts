import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createCustomFooter } from "../components/footer";

export function setupFooterHook(pi: ExtensionAPI) {
  const footer = createCustomFooter(pi);

  pi.on("session_start", async (event, ctx) => {
    footer.setup(ctx, {
      showResumeCacheFreshness:
        event.reason === "resume" || event.reason === "startup",
    });
  });

  pi.on("session_shutdown", async () => {
    footer.cleanup();
  });
}
