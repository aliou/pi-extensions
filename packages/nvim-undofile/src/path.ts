import { realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { expandHomePath } from "@harness/utils";

export const DEFAULT_UNDODIR = "~/.local/state/nvim/undo//";

export function normalizeUndodir(undodir = DEFAULT_UNDODIR): string {
  const first = undodir.split(",")[0] ?? undodir;
  const expanded = expandHomePath(first.replace(/\/+$/, ""));
  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

export async function getUndoFilePath(
  filePath: string,
  undodir = DEFAULT_UNDODIR,
): Promise<string> {
  const resolvedFilePath = await realpath(filePath).catch(() =>
    resolve(filePath),
  );
  const mungedName = resolvedFilePath.replace(/[\\/]/g, "%");
  return join(normalizeUndodir(undodir), mungedName);
}
