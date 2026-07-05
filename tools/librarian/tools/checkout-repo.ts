import { stat } from "node:fs/promises";
import type {
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const Params = Type.Object({
  repository: Type.String({
    description:
      'Repo reference: "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo", or a generic git URL (https/ssh).',
  }),
  forceUpdate: Type.Optional(
    Type.Boolean({
      description:
        "Force a fetch even if the throttle window has not elapsed. Default false.",
    }),
  ),
});

const CACHE_ROOT = `${process.env.HOME}/.cache/checkouts`;
const FETCH_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export interface ParsedRef {
  /** Absolute path on disk: ~/.cache/checkouts/<host>/<org>/<repo> */
  cachePath: string;
  /** Clone URL (https or ssh). */
  cloneUrl: string;
  /** Human-readable label like "github.com/owner/repo". */
  label: string;
}

/**
 * Parse a repository reference into cache path + clone URL.
 *
 * Supported formats:
 *   - owner/repo                        → github.com/owner/repo
 *   - github.com/owner/repo             → github.com/owner/repo
 *   - https://github.com/owner/repo     → github.com/owner/repo
 *   - https://github.com/owner/repo.git → github.com/owner/repo
 *   - git@github.com:owner/repo.git     → github.com/owner/repo
 *   - https://gitlab.com/org/repo       → gitlab.com/org/repo
 *   - git@gitlab.com:org/repo.git       → gitlab.com/org/repo
 */
export function parseRef(repository: string): ParsedRef {
  const trimmed = repository.trim();

  // SSH form: git@host:org/repo(.git)
  const sshMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    const host = sshMatch[1];
    const path = sshMatch[2];
    return {
      cachePath: `${CACHE_ROOT}/${host}/${path}`,
      cloneUrl: trimmed,
      label: `${host}/${path}`,
    };
  }

  // HTTPS form
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    const url = new URL(trimmed);
    const host = url.hostname;
    const path = url.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
    return {
      cachePath: `${CACHE_ROOT}/${host}/${path}`,
      cloneUrl: trimmed,
      label: `${host}/${path}`,
    };
  }

  // Bare host-less "owner/repo" → default to github.com
  if (/^[^/]+\/[^/]+$/.test(trimmed)) {
    return {
      cachePath: `${CACHE_ROOT}/github.com/${trimmed}`,
      cloneUrl: `https://github.com/${trimmed}.git`,
      label: `github.com/${trimmed}`,
    };
  }

  // "github.com/owner/repo" or "<host>/<org>/<repo>"
  const parts = trimmed.replace(/\.git$/, "").split("/");
  if (parts.length >= 3) {
    const host = parts[0];
    const path = parts.slice(1).join("/");
    return {
      cachePath: `${CACHE_ROOT}/${host}/${path}`,
      cloneUrl: `https://${host}/${path}.git`,
      label: `${host}/${path}`,
    };
  }

  throw new Error(
    `Invalid repository reference: "${repository}". Use "owner/repo", a full URL, or an SSH git URL.`,
  );
}

function textResult(text: string, details?: unknown) {
  return { content: [{ type: "text" as const, text }], details };
}

function fetchMarkerPath(cachePath: string): string {
  return `${cachePath}/.pi_fetch_timestamp`;
}

async function isThrottled(cachePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(fetchMarkerPath(cachePath));
    return Date.now() - fileStat.mtime.getTime() < FETCH_THROTTLE_MS;
  } catch {
    return false;
  }
}

export function createCheckoutRepoTool(
  pi: ExtensionAPI,
  _cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "checkout_repo",
    label: "Checkout Repo",
    description: `Clone or reuse a local cache of a remote repository.

Returns the absolute local path. Use that path with ls, find, grep, and read to explore the code.

The first checkout of a repo is slow (full clone). Subsequent calls reuse the cached copy and fast-forward the branch if possible. Fetches are throttled to once every 5 minutes unless forceUpdate is set.

Do NOT edit files in the cached checkout.`,
    promptSnippet:
      "Clone or reuse a local cache of a remote repo; returns absolute path",
    promptGuidelines: [
      "Always call checkout_repo before exploring a remote repository; never assume a local path.",
      "Pass the returned absolute path to ls/find/grep/read/git_log/git_show.",
      "Do not edit, commit, push, or modify files in cached checkouts; they are read-only.",
    ],
    parameters: Params,
    async execute(_id, params, signal) {
      const ref = parseRef(params.repository);

      // --- Clone if missing ---
      const existsResult = await pi.exec("test", ["-d", ref.cachePath], {
        signal,
      });
      const exists = existsResult.code === 0;

      if (!exists) {
        // Ensure parent directory exists
        await pi.exec("mkdir", ["-p", `${ref.cachePath}/..`], { signal });

        // Clone with blobless filter for speed
        const cloneResult = await pi.exec(
          "git",
          [
            "clone",
            "--filter=blob:none",
            "--no-tags",
            ref.cloneUrl,
            ref.cachePath,
          ],
          { signal, timeout: 120_000 },
        );

        if (cloneResult.code !== 0) {
          const msg = cloneResult.stderr.trim() || cloneResult.stdout.trim();
          // Clean up partial clone
          await pi.exec("rm", ["-rf", ref.cachePath], { signal });
          throw new Error(`git clone failed for ${ref.label}: ${msg}`);
        }

        return textResult(ref.cachePath, {
          path: ref.cachePath,
          label: ref.label,
          freshlyCloned: true,
        });
      }

      // --- Reuse cached checkout ---
      const throttled = await isThrottled(ref.cachePath);
      const shouldFetch = params.forceUpdate || !throttled;

      if (shouldFetch) {
        // Check if working tree is clean
        const statusResult = await pi.exec("git", ["status", "--porcelain"], {
          cwd: ref.cachePath,
          signal,
        });

        const isClean =
          statusResult.code === 0 && statusResult.stdout.trim() === "";

        if (isClean) {
          // Try fast-forward from upstream
          const branchResult = await pi.exec(
            "git",
            ["rev-parse", "--abbrev-ref", "@{upstream}"],
            { cwd: ref.cachePath, signal },
          );

          if (branchResult.code === 0) {
            // Has upstream — fetch + fast-forward
            await pi.exec("git", ["fetch", "--no-tags"], {
              cwd: ref.cachePath,
              signal,
              timeout: 60_000,
            });
            await pi.exec("git", ["merge", "--ff-only"], {
              cwd: ref.cachePath,
              signal,
            });
          }
        }

        // Record fetch timestamp
        await pi.exec("touch", [fetchMarkerPath(ref.cachePath)], { signal });
      }

      const currentBranch = await pi.exec(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: ref.cachePath, signal },
      );
      const branch =
        currentBranch.code === 0 ? currentBranch.stdout.trim() : "unknown";

      return textResult(ref.cachePath, {
        path: ref.cachePath,
        label: ref.label,
        branch,
        freshlyCloned: false,
      });
    },
  };
}
