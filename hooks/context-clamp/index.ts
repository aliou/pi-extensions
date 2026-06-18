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
 * We clamp on three events because the session's model object can be replaced
 * (registry refresh, model restore, provider (un)registration) at various
 * points, replacing our mutated reference with a fresh unclamped one:
 *   - `session_start` — clamp the initial model early. Catches any
 *     context-window read between startup and the first turn.
 *   - `model_select` — clamp on every model swap (/model, cycling). Also
 *     covers re-selections after a `modelRegistry.refresh()` (e.g. triggered
 *     by the `compact-model-swap` hook), which rebuilds the model object
 *     fresh and unclamped.
 *   - `before_agent_start` — clamp right before each turn. This is the
 *     safety net: whatever model object the session settled on (after any
 *     restore/refresh/reassignment that happened since session_start), it is
 *     clamped at the last moment before the turn reads `contextWindow`.
 */
export const CONTEXT_WINDOW_CLAMP = 272_000;

export default function contextClamp(pi: ExtensionAPI): void {
  /**
   * Clamp a single model's context window in place and notify.
   *
   * Guarded against non-finite / missing contextWindow so unknown custom
   * models are skipped rather than corrupted.
   */
  const clampModel = (model: Model<Api> | undefined, ctx: ExtensionContext) => {
    if (!model) {
      return;
    }
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
    clampModel(ctx.model, ctx);
  });

  pi.on("model_select", async (event, ctx) => {
    clampModel(event.model, ctx);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    clampModel(ctx.model, ctx);
  });
}
