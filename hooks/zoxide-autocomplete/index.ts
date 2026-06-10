/**
 * `@z:` zoxide autocomplete provider.
 *
 * On `@z:<token>` in the input editor, suggests zoxide entries under
 * ~/code/src. Accepting a completion replaces the full `@z:<token>` prefix
 * with the tilde path.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMPLETION_EVENT,
  once,
} from "@harness/events";
import { createProjectAutocompleteProvider } from "./provider";

export default async function (pi: ExtensionAPI) {
  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMPLETION_EVENT, {
      trigger: "@z:",
      description: "insert project path",
    });
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.addAutocompleteProvider((current) =>
      createProjectAutocompleteProvider(current, pi),
    );
  });
}
