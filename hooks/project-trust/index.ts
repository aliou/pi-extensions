/**
 * Auto-trust projects whose cwd matches configured path prefixes.
 *
 * Listens to the `project_trust` event and returns a "yes" decision
 * (with `remember: true`) when the cwd falls under one of the trusted
 * prefixes configured in `~/.pi/agent/extensions/trust-paths.json`.
 *
 * If no prefix matches, returns "undecided" so the built-in trust
 * prompt or other extensions handle the decision.
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
    async (event, _ctx): Promise<ProjectTrustEventResult> => {
      const config = readTrustPathsConfig();
      const prefixes = resolveTrustedPaths(config);

      if (isTrustedPath(event.cwd, prefixes)) {
        return { trusted: "yes", remember: true };
      }

      return { trusted: "undecided" };
    },
  );
}
