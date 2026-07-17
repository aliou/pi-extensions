import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { escapeXml } from "@harness/utils";

export const LOCAL_AGENTS_FILENAME = "AGENTS.local.md";
export const LOCAL_AGENTS_DIR = ".agents";

export interface LocalAgentsFile {
  path: string;
  content: string;
}

/**
 * Load `.agents/AGENTS.local.md` from `cwd` only.
 *
 * Unlike Pi's built-in `AGENTS.md` discovery (which walks from `cwd` up to the
 * filesystem root), this only checks the current working directory. Parent
 * directories are intentionally not searched.
 */
export function loadLocalAgentsFile(cwd: string): LocalAgentsFile | null {
  const filePath = join(cwd, LOCAL_AGENTS_DIR, LOCAL_AGENTS_FILENAME);
  if (!existsSync(filePath)) return null;
  try {
    return { path: filePath, content: readFileSync(filePath, "utf-8") };
  } catch {
    return null;
  }
}

/**
 * Format the local file as a `<project_context>` block matching Pi's built-in
 * rendering of `AGENTS.md`/`CLAUDE.md` (see `core/system-prompt.ts`):
 *
 * ```
 * <project_context>
 *
 * Project-specific instructions and guidelines:
 *
 * <project_instructions path="/abs/path">
 * {content}
 * </project_instructions>
 *
 * </project_context>
 * ```
 *
 * Returns the original prompt unchanged when there is nothing to add.
 */
export function appendLocalAgents(
  systemPrompt: string,
  file: LocalAgentsFile | null,
): string {
  if (!file) return systemPrompt;
  const body = file.content.trim();
  if (body.length === 0) return systemPrompt;

  const block = [
    "",
    "",
    "<project_context>",
    "",
    "Project-specific instructions and guidelines:",
    "",
    `<project_instructions path="${escapeXml(file.path)}">`,
    body,
    "</project_instructions>",
    "",
    "</project_context>",
  ].join("\n");

  return `${systemPrompt}${block}\n`;
}
