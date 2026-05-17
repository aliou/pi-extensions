import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type {
  ExtensionAPI,
  WriteToolInput,
} from "@earendil-works/pi-coding-agent";
import { createWriteTool } from "@earendil-works/pi-coding-agent";
import { updateUndofileForExternalWrite } from "@harness/nvim-undofile";
import { expandHomePath } from "@harness/utils";

function resolveToCwd(path: string, cwd: string): string {
  const normalized = path.startsWith("@") ? path.slice(1) : path;
  const expanded = expandHomePath(normalized);
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
}

export default function (pi: ExtensionAPI): void {
  const cwd = process.cwd();
  const nativeWrite = createWriteTool(cwd);

  pi.registerTool({
    ...nativeWrite,
    name: "write-nvim-undo",
    label: "write-nvim-undo",
    description: `${nativeWrite.description} Also updates the matching Neovim undofile when possible.`,
    promptSnippet: "Write files while preserving Neovim persistent undo",
    promptGuidelines: [
      "Use write-nvim-undo like write when Neovim persistent undo should be preserved.",
    ],
    async execute(toolCallId, params, signal, onUpdate) {
      const { path, content } = params as WriteToolInput;
      const absolutePath = resolveToCwd(path, cwd);
      const oldContent = await readFile(absolutePath, "utf8").catch(
        () => undefined,
      );

      const result = await nativeWrite.execute(
        toolCallId,
        params as WriteToolInput,
        signal,
        onUpdate,
      );

      if (oldContent !== undefined) {
        await updateUndofileForExternalWrite({
          filePath: absolutePath,
          oldContent,
          newContent: content,
        });
      }

      return result;
    },
  });
}
