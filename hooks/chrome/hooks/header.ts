import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createCustomHeader } from "../components/header";

export function setupHeaderHook(pi: ExtensionAPI) {
  const header = createCustomHeader(pi);

  pi.on("session_start", async (_event, ctx) => {
    header.setup(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    header.cleanup(ctx);
  });
}
