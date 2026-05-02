import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerQqCommand } from "./commands/qq";
import { clearQqWidget } from "./components/widget";

export default async function (pi: ExtensionAPI): Promise<void> {
  registerQqCommand(pi);

  pi.on("agent_start", async (_event, ctx) => {
    clearQqWidget(ctx);
  });
}
