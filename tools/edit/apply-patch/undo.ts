import { parsePatch } from "./parser";
import type { ApplyPatchToolParams } from "./types";

export const resolveApplyPatch = (input: Record<string, unknown>): string[] => {
  const params = input as ApplyPatchToolParams;
  const patchText = params.input;

  try {
    const { hunks } = parsePatch(patchText);
    return hunks.map((hunk) => {
      if (hunk.type === "update" && hunk.movePath) return hunk.movePath;
      return hunk.path;
    });
  } catch {
    return [];
  }
};
