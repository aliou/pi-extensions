import type {
  EditToolInput,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { createEditTool } from "@mariozechner/pi-coding-agent";

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
  const nativeEdit = createEditTool(process.cwd());

  pi.registerTool({
    ...nativeEdit,
    prepareArguments(args) {
      return prepareEditArguments(args, nativeEdit.prepareArguments);
    },
  });
}
