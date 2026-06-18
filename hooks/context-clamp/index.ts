import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

/**
 * Hard cap applied to the current model's context window at runtime.
 *
 * Mutates `model.contextWindow` in place. The session holds the same object
 * reference it reads `contextWindow` from at every context-size check
 * (agent-session.js reads `this.model?.contextWindow`), so the clamp takes
 * effect immediately without writing to models.json or re-registering
 * providers.
 *
 * Two events:
 *   - `session_start` clamps the initial/restore model. Needed because
 *     `model_select` is never emitted with the `"restore"` source at startup,
 *     so the initial model wouldn't be clamped otherwise.
 *   - `model_select` clamps the newly selected model. Covers model swaps and
 *     re-selections after a `modelRegistry.refresh()` (e.g. triggered by the
 *     `compact-model-swap` hook), which rebuilds the model object fresh and
 *     unclamped.
 */
export const CONTEXT_WINDOW_CLAMP = 272_000;

export default function contextClamp(pi: ExtensionAPI): void {
  /**
   * Clamp a single model's context window in place and notify.
   *
   * Guarded against non-finite / missing contextWindow so unknown custom
   * models are skipped rather than corrupted.
   */
  const clampModel = (model: Model<Api>, ctx: ExtensionContext) => {
    const current = model.contextWindow;
    if (typeof current !== "number" || !Number.isFinite(current)) return;
    if (current <= CONTEXT_WINDOW_CLAMP) return;

    model.contextWindow = CONTEXT_WINDOW_CLAMP;

    ctx.ui.notify(
      `Context window clamped to ${CONTEXT_WINDOW_CLAMP.toLocaleString()} tokens for ${model.provider}/${model.id}.`,
      "info",
    );
  };

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.model) {
      return;
    }

    clampModel(ctx.model, ctx);
  });

  pi.on("model_select", async (event, ctx) => {
    clampModel(event.model, ctx);
  });
}
