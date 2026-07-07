/**
 * Default `edit` tool override.
 *
 * Wraps Pi's native edit tool to tolerate stray empty-string entries in the
 * `edits` array (some models occasionally emit `""` inside `edits`, which fails
 * schema validation before the native tool can run). Strips those entries in
 * `prepareArguments`, then delegates to the native edit tool unchanged.
 *
 * This is the edit interface used for non-Codex, non-Kimi models (Anthropic,
 * GLM, and the rest). For Anthropic models, strict tool-use validation is
 * layered on top via `strict.ts` + the `before_provider_request` hook in
 * `index.ts`.
 */

import type { EditToolInput } from "@earendil-works/pi-coding-agent";
import { createEditToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { formatDisplayPath } from "@harness/utils";
export function sanitizeArguments(args: unknown): EditToolInput {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return args as EditToolInput;
  }

  const rawArgs = args as {
    path?: unknown;
    edits?: unknown;
  };

  if (!Array.isArray(rawArgs.edits)) {
    return rawArgs as EditToolInput;
  }

  return {
    ...rawArgs,
    edits: rawArgs.edits.filter((edit) => edit !== ""),
  } as EditToolInput;
}

export function prepareEditArguments(
  args: unknown,
  nativePrepareArguments?: (args: EditToolInput) => EditToolInput,
): EditToolInput {
  const sanitizedArgs = sanitizeArguments(args);

  return nativePrepareArguments
    ? nativePrepareArguments(sanitizedArgs)
    : sanitizedArgs;
}

/**
 * Register the default `edit` tool (wrapping the native definition). The native
 * definition is created relative to `cwd` so path resolution matches Pi core.
 * The return type is inferred from the native tool so the overridden
 * `prepareArguments` / `renderCall` keep their parameter types.
 */
export function createDefaultEditToolDefinition(
  cwd: string,
): ReturnType<typeof createEditToolDefinition> {
  const nativeEdit = createEditToolDefinition(cwd);
  const nativeRenderCall = nativeEdit.renderCall;

  return {
    ...nativeEdit,
    prepareArguments(args: unknown) {
      return prepareEditArguments(args, nativeEdit.prepareArguments);
    },
    renderCall(args, theme, ctx) {
      const displayPath = formatDisplayPath(args.path, ctx.cwd);
      if (nativeRenderCall) {
        return nativeRenderCall({ ...args, path: displayPath }, theme, ctx);
      }
      return new Text(
        `${theme.fg("toolTitle", theme.bold("Edit"))} ${theme.fg("text", displayPath)}`,
        0,
        0,
      );
    },
  };
}
