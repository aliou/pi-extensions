import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import type {
  EditToolInput,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { createEditTool } from "@earendil-works/pi-coding-agent";
import { updateUndofileForExternalWrite } from "@harness/nvim-undofile";

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
  const originalContents = new Map<string, string>();
  const nativeEdit = createEditTool(process.cwd(), {
    operations: {
      async readFile(path) {
        const buffer = await readFile(path);
        originalContents.set(path, buffer.toString("utf8"));
        return buffer;
      },
      async writeFile(path, content) {
        const oldContent = originalContents.get(path);
        await writeFile(path, content, "utf8");
        originalContents.delete(path);

        if (oldContent !== undefined) {
          await updateUndofileForExternalWrite({
            filePath: path,
            oldContent,
            newContent: content,
          });
        }
      },
      access: (path) => access(path, constants.R_OK | constants.W_OK),
    },
  });

  pi.registerTool({
    ...nativeEdit,
    name: "edit-nvim-undo",
    label: "edit-nvim-undo",
    description: `${nativeEdit.description} Also updates the matching Neovim undofile when possible.`,
    promptSnippet: "Edit files while preserving Neovim persistent undo",
    promptGuidelines: [
      "Use edit-nvim-undo like edit when Neovim persistent undo should be preserved.",
    ],
    prepareArguments(args) {
      return prepareEditArguments(args, nativeEdit.prepareArguments);
    },
  });
}
