/**
 * `@tmux:` tmux session autocomplete provider.
 *
 * On `@tmux:<token>` in the input editor, suggests tmux sessions filtered
 * by token. Accepting a completion inserts `tmux:<session> `.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMPLETION_EVENT,
  once,
} from "@harness/events";
import { createTmuxAutocompleteProvider } from "./provider";

export default function (pi: ExtensionAPI) {
  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMPLETION_EVENT, {
      trigger: "@tmux:",
      description: "insert tmux target",
    });
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.addAutocompleteProvider((current) =>
      createTmuxAutocompleteProvider(current, pi),
    );
  });
}
