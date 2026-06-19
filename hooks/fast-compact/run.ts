import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  CompactionResult,
  ExtensionAPI,
  ExtensionContext,
  SessionBeforeCompactEvent,
} from "@earendil-works/pi-coding-agent";
import { ExternalEditorComponent } from "@harness/ui";

import { fastCompact } from "./compaction";
import { selectFastModel } from "./fast-model";
import { createSummarizationSubagent } from "./subagent";
import type { CompactChoice } from "./types";

interface RunCompactionOptions {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  event: SessionBeforeCompactEvent;
  choice: CompactChoice;
}

export async function runCompaction({
  pi,
  ctx,
  event,
  choice,
}: RunCompactionOptions): Promise<CompactionResult | undefined> {
  const resolution = resolveModelAndThinking(ctx, pi, choice);
  if (!resolution) {
    ctx.ui.notify(
      "[fast-compact] no model available for compaction",
      "warning",
    );
    return undefined;
  }

  const { model, thinking } = resolution;
  const subagent = createSummarizationSubagent(pi, model, thinking);

  const summarize = async (prompt: string) => {
    const result = await subagent.runWithParams(
      { prompt },
      { callId: "fast-compact", ctx, signal: event.signal },
    );

    if (result.details.status === "error" || result.details.error) {
      throw new Error(result.details.error ?? "Subagent summarization failed");
    }

    const response = result.details.response;
    if (response === undefined || response === "") {
      throw new Error("Subagent returned empty summary");
    }

    return response;
  };

  const result = await fastCompact(
    event.preparation,
    event.customInstructions,
    summarize,
  );

  if (!choice.edit) {
    return result;
  }

  return editSummary(ctx, result);
}

function resolveModelAndThinking(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  choice: CompactChoice,
):
  | {
      model: Model<Api>;
      thinking: ThinkingLevel;
    }
  | undefined {
  if (choice.mode === "fast") {
    const fast = selectFastModel(ctx);
    if (fast) return fast;
    ctx.ui.notify(
      "[fast-compact] no fast model available, falling back to current model",
      "warning",
    );
  }

  const model = ctx.model;
  if (!model) return undefined;

  return { model, thinking: pi.getThinkingLevel() };
}

async function editSummary(
  ctx: ExtensionContext,
  result: CompactionResult,
): Promise<CompactionResult | undefined> {
  const dir = mkdtempSync(join(tmpdir(), "pi-fast-compact-"));
  const file = join(dir, "compaction.md");
  writeFileSync(file, result.summary, "utf-8");

  try {
    const exitCode = await ctx.ui.custom(ExternalEditorComponent.create(file));

    if (exitCode !== 0) {
      ctx.ui.notify("[fast-compact] editor exited without saving", "info");
      return undefined;
    }

    const edited = readFileSync(file, "utf-8");
    result.summary = edited;
    return result;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
