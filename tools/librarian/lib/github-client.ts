import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface GitHubClient {
  api(
    path: string,
    cwd: string,
    options?: {
      fields?: Record<string, string>;
      headers?: string[];
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      signal?: AbortSignal;
    },
  ): Promise<string>;
}

export function createGitHubClient(pi: ExtensionAPI): GitHubClient {
  return {
    async api(path, cwd, options = {}) {
      const args = ["api"];

      if (options.method) {
        args.push("--method", options.method);
      }

      args.push(path);

      for (const header of options.headers ?? []) {
        args.push("-H", header);
      }

      for (const [key, value] of Object.entries(options.fields ?? {})) {
        args.push("-f", `${key}=${value}`);
      }

      const result = await pi.exec("gh", args, {
        cwd,
        signal: options.signal,
      });

      if (result.code !== 0) {
        const message = result.stderr.trim() || result.stdout.trim();
        throw new Error(`gh ${args.join(" ")} failed: ${message}`);
      }

      return result.stdout.trimEnd();
    },
  };
}

export function textResult(text: string, details?: unknown) {
  return { content: [{ type: "text" as const, text }], details };
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

export function normalizeRepository(repository: string): string {
  let normalized = repository.trim();
  if (normalized.includes("://")) {
    const url = new URL(normalized);
    if (url.hostname !== "github.com") {
      throw new Error("Only github.com repositories are supported");
    }
    normalized = url.pathname;
  }
  normalized = normalized.replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid repository: expected "owner/repo" but got "${repository}"`,
    );
  }
  return `${parts[0]}/${parts[1]}`;
}
