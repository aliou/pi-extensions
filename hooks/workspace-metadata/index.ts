import { realpath } from "node:fs/promises";
import { hostname } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AD_WORKSPACE_METADATA_CAPTURED_EVENT } from "@harness/events";
import { parseGitRemotes, shouldCaptureWorkspaceMetadata } from "./helpers";
import {
  WORKSPACE_METADATA_CUSTOM_TYPE,
  type WorkspaceMetadata,
  type WorkspaceRemote,
} from "./types";

const GIT_TIMEOUT_MS = 2_000;

export default function workspaceMetadata(pi: ExtensionAPI): void {
  pi.on("session_start", async (event, ctx) => {
    if (
      !shouldCaptureWorkspaceMetadata(
        event.reason,
        ctx.sessionManager.getEntries(),
      )
    ) {
      return;
    }

    let cwd: string;
    try {
      cwd = await realpath(ctx.cwd);
    } catch {
      return;
    }

    let remotes: WorkspaceRemote[] = [];
    try {
      const result = await pi.exec("git", ["remote", "-v"], {
        cwd,
        timeout: GIT_TIMEOUT_MS,
      });
      if (result.code === 0) {
        remotes = parseGitRemotes(result.stdout);
      }
    } catch {
      remotes = [];
    }

    const metadata: WorkspaceMetadata = {
      hostname: hostname(),
      cwd,
      remotes,
    };

    pi.appendEntry<WorkspaceMetadata>(WORKSPACE_METADATA_CUSTOM_TYPE, metadata);
    pi.events.emit(AD_WORKSPACE_METADATA_CAPTURED_EVENT, metadata);
  });
}
