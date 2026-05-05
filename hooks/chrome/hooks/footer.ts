import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createCustomFooter } from "../components/footer";

export function setupFooterHook(pi: ExtensionAPI) {
  const footer = createCustomFooter(pi);

  pi.on("session_start", async (_event, ctx) => {
    footer.setup(ctx);
  });

  pi.on("session_shutdown", async () => {
    footer.cleanup();
  });
}
