/**
 * Find tool render functions.
 */

import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type { Theme } from "@earendil-works/pi-coding-agent";

export function renderCall(
  args: {
    pattern: string;
    path?: string;
    limit?: number;
  },
  theme: Theme,
) {
  return new ToolCallHeader(
    {
      toolName: "Find",
      mainArg: args.pattern,
      optionArgs: [
        ...(args.path ? [{ label: "in", value: args.path }] : []),
        ...(args.limit ? [{ label: "limit", value: String(args.limit) }] : []),
      ],
    },
    theme,
  );
}
