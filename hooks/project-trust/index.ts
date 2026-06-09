/**
 * Auto-trust projects whose cwd matches configured path prefixes.
 *
 * Listens to the `project_trust` event and returns a "yes" decision
 * (with `remember: true`) when the cwd falls under one of the trusted
 * prefixes configured in `~/.pi/agent/settings/trust-paths.json`.
 *
 * If no prefix matches and the cwd is not already in trust.json,
 * declines trust (without persisting) and notifies the user to use
 * `/trust` then `/reload`. If the cwd is already trusted via trust.json,
 * returns "undecided" so the core's saved decision is respected.
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
  getAgentDir,
  ProjectTrustStore,
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
      const notify = (message: string, level: "info" | "warning" | "error") => {
        ctx.ui.notify(`[harness] auto-trust: ${message}`, level);
      };

      const config = readTrustPathsConfig();
      const prefixes = resolveTrustedPaths(config);

      if (isTrustedPath(event.cwd, prefixes)) {
        notify(`Auto-trusting project: ${event.cwd}`, "info");
        return { trusted: "yes", remember: true };
      }

      // If the core trust store already has a saved decision, defer to it.
      // Without this check, returning "no" would override a saved trust
      // decision from /trust, because the project_trust event fires before
      // the core reads trust.json.
      const trustStore = new ProjectTrustStore(getAgentDir());
      if (trustStore.get(event.cwd) !== null) {
        return { trusted: "undecided" };
      }

      notify(
        `Project not in trusted paths: ${event.cwd}. Use /trust to save a trust decision, then /reload.`,
        "warning",
      );

      return { trusted: "no", remember: false };
    },
  );
}
