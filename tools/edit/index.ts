/**
 * Model-aware edit tool.
 *
 * Registers two edit interfaces and activates the right one per model:
 *
 *   - `apply_patch` (V4A freeform patch) for Codex / GPT-style models, which
 *     were post-trained on that format. It replaces `edit` and `write` for
 *     those models (apply_patch's Add File covers creation).
 *   - `edit` (native JSON old_string/new_string) for everyone else, including
 *     Anthropic, Kimi, and GLM. For Anthropic models, strict tool-use
 *     validation is enabled on the `edit` tool via `before_provider_request`.
 *
 * Routing runs on `session_start`, `model_select`, and `agent_start` (the last
 * is a backstop for startup-before-model-select). The active-tool set is swapped
 * in place with `pi.setActiveTools`, mirroring the `look_at` tool's pattern.
 *
 * File layout (per AGENTS.md): all `pi.*` / `ctx.*` calls live here. Pure logic
 * is in `router.ts`, `default/edit.ts`, `anthropic/strict.ts`, and `apply-patch/*`.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { enableStrictOnEditTool } from "./anthropic/strict";
import { createApplyPatchToolDefinition } from "./apply-patch/tool";
import { createDefaultEditToolDefinition } from "./default/edit";
import {
  type EditToolChoice,
  isAnthropicModel,
  pickEditTool,
  resolveActiveTools,
} from "./router";

export { prepareEditArguments, sanitizeArguments } from "./default/edit";

let currentChoice: EditToolChoice | null = null;
let removedByUs: string[] = [];

/** Swap the active edit interface to match the active model. */
function routeEditTool(pi: ExtensionAPI, model: unknown): void {
  const desired = pickEditTool(model as Parameters<typeof pickEditTool>[0]);
  if (desired === currentChoice) return;

  const { active, removedByUs: nextRemoved } = resolveActiveTools(
    pi.getActiveTools(),
    desired,
    removedByUs,
  );
  pi.setActiveTools(active);
  removedByUs = nextRemoved;
  currentChoice = desired;
}

export default function editTool(pi: ExtensionAPI): void {
  // Default `edit` (JSON) + Codex `apply_patch` (V4A). Both are registered up
  // front; routing enables the right one per model.
  pi.registerTool(createDefaultEditToolDefinition(process.cwd()));
  pi.registerTool(createApplyPatchToolDefinition(process.cwd()));

  pi.on("session_start", (_event, ctx) => {
    routeEditTool(pi, ctx.model);
  });

  pi.on("model_select", (event) => {
    routeEditTool(pi, event.model);
  });

  // Backstop: ensure routing is correct before the first turn even if
  // `session_start` ran before a model was selected.
  pi.on("agent_start", (_event, ctx) => {
    routeEditTool(pi, ctx.model);
  });

  // Anthropic strict tool-use: grammar-constrain the `edit` tool's output so
  // the model cannot emit malformed edit arguments.
  pi.on("before_provider_request", (event, ctx) => {
    if (!isAnthropicModel(ctx.model)) return;
    if (!pi.getActiveTools().includes("edit")) return;
    return enableStrictOnEditTool(event.payload);
  });
}
