/**
 * Grep tool render functions.
 */

import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type { Theme } from "@earendil-works/pi-coding-agent";

export function renderCall(
  args: {
    pattern: string;
    path?: string;
    glob?: string;
    ignoreCase?: boolean;
    literal?: boolean;
    context?: number;
    limit?: number;
  },
  theme: Theme,
) {
  return new ToolCallHeader(
    {
      toolName: "Grep",
      mainArg: args.literal ? `\`${args.pattern}\`` : `/${args.pattern || ""}/`,
      optionArgs: [
        ...(args.path ? [{ label: "in", value: args.path }] : []),
        ...(args.glob ? [{ label: "glob", value: args.glob }] : []),
        ...(args.limit ? [{ label: "limit", value: String(args.limit) }] : []),
        ...(args.ignoreCase
          ? [{ label: "icase", value: "true", tone: "accent" as const }]
          : []),
        ...(args.literal ? [{ label: "literal", value: "true" }] : []),
        ...(args.context
          ? [{ label: "ctx", value: String(args.context) }]
          : []),
      ],
    },
    theme,
  );
}
