import type { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { isNotNil, truncate } from "@harness/utils";
import type { SubagentConfig } from "../../types";
import type { ToolRenderContext } from "./types";

export function renderSubagentCall(
  config: SubagentConfig,
  args: Record<string, unknown>,
  theme: Theme,
  _ctx: ToolRenderContext,
) {
  const displayArgs = Object.entries(args)
    .filter(([key]) => key !== "sessionId")
    .map(
      ([key, value]) =>
        `${theme.fg("dim", key)}: ${truncate(String(value), 70)}`,
    )
    .join(", ");
  const sessionId = args.sessionId as string | undefined;
  const isResuming = isNotNil(sessionId);

  const header = [
    theme.fg("toolTitle", theme.bold(`${config.label}`)),
    displayArgs ? theme.fg("text", displayArgs) : undefined,
    isResuming &&
      theme.fg("muted", `(Resuming session ${sessionId ?? "none"})`),
  ]
    .filter(Boolean)
    .join(" ");

  return new Text(header, 0, 0);
}
