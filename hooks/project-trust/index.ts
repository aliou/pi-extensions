/**
 * Auto-trust projects whose cwd matches configured path prefixes.
 *
 * Listens to the `project_trust` event and returns a "yes" decision
 * (with `remember: true`) when the cwd falls under one of the trusted
 * prefixes configured in `~/.pi/agent/settings/trust-paths.json`.
 *
 * If no prefix matches, declines trust (without persisting) and notifies
 * the user to use `/trust` then `/reload` if they want to trust the project.
 *
 * Config format:
 * ```json
 * {
 *   "trustedPaths": [
 *     "~/code/src/github.com/aliou",
 *     "~/code/src/pi.dev"
 *   ]
 * }
 * ```
 */

import type {
  ExtensionAPI,
  ProjectTrustEventResult,
} from "@earendil-works/pi-coding-agent";
import {
  isTrustedPath,
  readTrustPathsConfig,
  resolveTrustedPaths,
} from "./config";

export default function projectTrust(pi: ExtensionAPI): void {
  pi.on(
    "project_trust",
    async (event, ctx): Promise<ProjectTrustEventResult> => {
      const config = readTrustPathsConfig();
      const prefixes = resolveTrustedPaths(config);

      if (isTrustedPath(event.cwd, prefixes)) {
        ctx.ui.notify(`Auto-trusting project: ${event.cwd}`, "info");
        return { trusted: "yes", remember: true };
      }

      ctx.ui.notify(
        "Project not in trusted paths. Use /trust to save a trust decision, then /reload.",
        "warning",
      );

      return { trusted: "no", remember: false };
    },
  );
}
