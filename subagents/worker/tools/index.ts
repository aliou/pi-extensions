/**
 * Worker tool wrappers with scope and policy enforcement.
 */

import type { createReadOnlyTools } from "@mariozechner/pi-coding-agent";
import { createGuardedBashTool } from "@subagents/worker/tools/guarded-bash";
import { createScopedEditTool } from "@subagents/worker/tools/scoped-edit";
import { createScopedReadTool } from "@subagents/worker/tools/scoped-read";
import { createScopedWriteTool } from "@subagents/worker/tools/scoped-write";
import { resolveAllowedPaths } from "@subagents/worker/utils/path-scope";

export type WorkerBuiltinTool = ReturnType<typeof createReadOnlyTools>[number];

export function createWorkerTools(
  cwd: string,
  files: string[],
): WorkerBuiltinTool[] {
  const allowedPaths = resolveAllowedPaths(cwd, files);

  const scopedReadTool: WorkerBuiltinTool = createScopedReadTool(
    cwd,
    files,
    allowedPaths,
  );
  const scopedEditTool: WorkerBuiltinTool = createScopedEditTool(
    cwd,
    files,
    allowedPaths,
  );
  const scopedWriteTool: WorkerBuiltinTool = createScopedWriteTool(
    cwd,
    files,
    allowedPaths,
  );
  const guardedBashTool: WorkerBuiltinTool = createGuardedBashTool(cwd);

  return [scopedReadTool, scopedEditTool, scopedWriteTool, guardedBashTool];
}
