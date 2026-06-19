import type {
  EditToolInput,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { createEditToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { formatDisplayPath } from "@harness/utils";

/**
 * Override the built-in edit tool to tolerate stray empty-string entries in
 * the edits array.
 *
 * Some models occasionally emit `""` inside `edits`, which fails schema
 * validation before the native tool can run. Strip those entries in
 * prepareArguments, then delegate to the native edit tool unchanged.
 */
function sanitizeArguments(args: unknown): EditToolInput {
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

export default function (pi: ExtensionAPI): void {
  const nativeEdit = createEditToolDefinition(process.cwd());

  pi.registerTool({
    ...nativeEdit,
    prepareArguments(args) {
      return prepareEditArguments(args, nativeEdit.prepareArguments);
    },
    renderCall(args, theme, ctx) {
      const displayPath = formatDisplayPath(args.path, ctx.cwd);
      if (nativeEdit.renderCall) {
        return nativeEdit.renderCall(
          { ...args, path: displayPath },
          theme,
          ctx,
        );
      }
      return new Text(
        `${theme.fg("toolTitle", theme.bold("Edit"))} ${theme.fg("text", displayPath)}`,
        0,
        0,
      );
    },
  });
}
