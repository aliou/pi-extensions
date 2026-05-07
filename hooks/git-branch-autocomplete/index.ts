/**
 * `@g:` local git branch autocomplete provider.
 *
 * On `@g:<token>` in the input editor, suggests local branches from the
 * current repository. Accepting a completion replaces the full `@g:<token>`
 * prefix with the branch name only.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createGitBranchAutocompleteProvider } from "./provider";

export default async function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const cwd = ctx.cwd;

    ctx.ui.addAutocompleteProvider((current) =>
      createGitBranchAutocompleteProvider(current, cwd),
    );
  });
}
