/**
 * Auto-trust projects whose cwd matches configured path prefixes.
 *
 * Listens to the `project_trust` event and returns a "yes" decision
 * (with `remember: true`) when the cwd falls under one of the trusted
 * prefixes configured in the trust-paths config
 * (`$PI_CODING_AGENT_DIR/settings/trust-paths.json`).
 *
 * If no prefix matches, returns "undecided" so the core flow handles
 * it: core checks trust.json (with parent-directory inheritance since
 * 0.79.1), then `defaultProjectTrust` setting, then the built-in
 * interactive prompt.
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
        ctx.ui.notify(`[harness] auto-trust: ${event.cwd}`, "info");
        return { trusted: "yes", remember: true };
      }

      return { trusted: "undecided" };
    },
  );
}
