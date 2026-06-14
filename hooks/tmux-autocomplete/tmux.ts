import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface TmuxSession {
  /** Session name. */
  name: string;
  /** Number of windows in the session. */
  windows: number;
  /** Whether the session is attached. */
  attached: boolean;
}

/**
 * List tmux sessions via `tmux list-sessions`.
 * Returns an empty array if tmux is not running or the command fails.
 */
export async function listSessions(
  pi: ExtensionAPI,
  signal?: AbortSignal,
): Promise<TmuxSession[]> {
  const result = await pi.exec(
    "tmux",
    [
      "list-sessions",
      "-F",
      "#{session_name}:#{session_windows}:#{session_attached}",
    ],
    { signal },
  );

  if (result.code !== 0 || !result.stdout.trim()) {
    return [];
  }

  const sessions: TmuxSession[] = [];

  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [name, windows, attached] = trimmed.split(":");
    if (!name) continue;

    sessions.push({
      name,
      windows: Number.parseInt(windows ?? "0", 10),
      attached: attached === "1",
    });
  }

  return sessions;
}
