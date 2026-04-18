import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerQqCommand } from "./commands/qq";
import { setupQqContextFilter } from "./hooks/context-filter";
import { registerQqRenderer } from "./lib/renderer";
import { qqPending } from "./lib/types";

const QQ_WIDGET_ID = "qq";

export default async function (pi: ExtensionAPI): Promise<void> {
  registerQqCommand(pi);
  registerQqRenderer(pi);
  setupQqContextFilter(pi);

  // When the user sends a new message, clear any pending QQ messages
  // and remove the result widget above the editor. This makes the
  // custom renderer display them in their proper session position.
  // We use agent_start (not turn_start/agent_end) because the
  // widget should stay visible while the user reads the result, even
  // after the agent finishes — only transitioning to in-session
  // rendering when the user actually sends a new message.
  pi.on("agent_start", async (_event, ctx) => {
    if (qqPending.size > 0) {
      qqPending.clear();
      ctx.ui.setWidget(QQ_WIDGET_ID, undefined);
    }
  });
}
