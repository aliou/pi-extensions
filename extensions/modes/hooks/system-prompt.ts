import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_FAMILY,
  getPromptForFamily,
  PROMPT_FAMILY_MARKER,
  resolvePromptFamily,
} from "../lib/prompt-families";
import { getCurrentMode } from "../state";

/**
 * Extract the "Available tools:" through end of "Guidelines:" sections
 * from pi's base prompt. Returns empty string if markers not found.
 */
function extractToolsAndGuidelines(aboveMarker: string): string {
  const toolsStart = aboveMarker.indexOf("\nAvailable tools:\n");
  if (toolsStart === -1) return "";

  const piDocsStart = aboveMarker.indexOf("\nPi documentation");
  const end = piDocsStart !== -1 ? piDocsStart : aboveMarker.length;

  return aboveMarker.slice(toolsStart, end).trim();
}

/** Tracks providers we've already warned about for default-family fallback. */
const warnedProviders = new Set<string>();

export function setupSystemPromptHook(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event, ctx) => {
    const mode = getCurrentMode();

    // Not into a cat and mouse game, so just append the mode system prompt to the default
    // system prompt for ant models. This triggers the filter on ant's side and forces the use
    // of the extra usage thingy.
    if (ctx.model?.provider === "anthropic") {
      if (!mode.systemPrompt) return;
      return {
        systemPrompt: `${event.systemPrompt}\n\n${mode.systemPrompt}`,
      };
    }

    // If marker not found, skip family replacement -- just append mode prompt.
    if (!event.systemPrompt.includes(PROMPT_FAMILY_MARKER)) {
      if (!mode.systemPrompt) return;
      return {
        systemPrompt: `${event.systemPrompt}\n\n${mode.systemPrompt}`,
      };
    }

    // Resolve family from current model
    const { family, isDefault } = resolvePromptFamily(
      ctx.model?.provider,
      ctx.model?.id,
    );

    if (
      isDefault &&
      ctx.model?.provider &&
      !warnedProviders.has(ctx.model.provider)
    ) {
      warnedProviders.add(ctx.model.provider);
      ctx.ui.notify(
        `No prompt family for ${ctx.model.provider}, using ${DEFAULT_FAMILY}`,
        "warning",
      );
    }

    // Split at marker
    const markerIdx = event.systemPrompt.indexOf(PROMPT_FAMILY_MARKER);
    const aboveMarker = event.systemPrompt.slice(0, markerIdx);
    const belowMarker = event.systemPrompt.slice(
      markerIdx + PROMPT_FAMILY_MARKER.length,
    );

    // Extract tools + guidelines from pi's base prompt
    const toolsAndGuidelines = extractToolsAndGuidelines(aboveMarker);

    // Mode prompt replaces family prompt. Family prompt is fallback.
    const basePrompt = mode.systemPrompt
      ? mode.systemPrompt
      : getPromptForFamily(family);

    const parts = [basePrompt];
    if (toolsAndGuidelines) {
      parts.push(toolsAndGuidelines);
    }
    parts.push(belowMarker.trimStart());

    const systemPrompt = parts.join("\n\n");

    return { systemPrompt };
  });
}
