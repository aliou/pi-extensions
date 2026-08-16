import type {
  ExtensionAPI,
  ExtensionCommandContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";
import { QqDisplayOverlay } from "./components/display-overlay";
import { type QqMode, QqModePicker } from "./components/mode-picker";
import { QqSessionPicker } from "./components/session-picker";
import {
  clearQqWidget,
  showLoadingWidget,
  showResultWidget,
} from "./components/widget";
import { buildQqSessionSummaries, type QqSessionSummary } from "./context";
import {
  buildQqResumeMessage,
  buildQqSystemPrompt,
  buildQqUserMessage,
} from "./prompt";
import { runQq } from "./subagent";
import { QQ_ANSWER_TYPE, type QqAnswerDetails, type QqRunSpec } from "./types";

export default async function (pi: ExtensionAPI): Promise<void> {
  pi.registerCommand("qq", {
    description: "Ask a quick side question without interrupting the agent",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/qq requires interactive mode", "error");
        return;
      }
      if (!ctx.model) {
        ctx.ui.notify("No model selected", "error");
        return;
      }

      await runQqCommand(pi, ctx, args?.trim() ?? "");
    },
  });

  pi.registerCommand("qq:dismiss", {
    description: "Dismiss the qq widget",
    handler: async (_args, ctx) => {
      clearQqWidget(ctx);
    },
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "qq",
      description: "quick question / side chat",
    });
  });

  pi.on("agent_start", async (_event, ctx) => {
    clearQqWidget(ctx);
  });
}

async function runQqCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  arg: string,
): Promise<void> {
  const summaries = buildQqSessionSummaries(ctx.sessionManager.getBranch());

  // No history yet: the only option is a new side chat.
  if (summaries.length === 0) {
    await runNewQqFlow(pi, ctx, arg);
    return;
  }

  // History exists: ask what to do.
  const mode = await pickMode(ctx, !!arg);
  if (!mode) {
    ctx.ui.notify("qq cancelled", "info");
    return;
  }

  if (mode === "display") {
    await openDisplay(ctx, summaries);
    return;
  }

  if (mode === "new") {
    await runNewQqFlow(pi, ctx, arg);
    return;
  }

  // resume
  const sessionId = await pickResumeSession(ctx, summaries);
  if (!sessionId) {
    ctx.ui.notify("qq cancelled", "info");
    return;
  }

  await runResumeQqFlow(pi, ctx, arg, sessionId);
}

/** New side chat: prompt for a question when no arg, then run a new subagent. */
async function runNewQqFlow(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  arg: string,
): Promise<void> {
  const question = await resolveQuestion(ctx, arg, "Ask a quick question…");
  if (!question) return;

  const systemPrompt = buildQqSystemPrompt(ctx);
  const userMessage = buildQqUserMessage(ctx, question);
  await executeQq(pi, ctx, {
    mode: "new",
    question,
    systemPrompt,
    userMessage,
  });
}

/** Resume an existing side chat: send a follow-up to a prior qq subagent. */
async function runResumeQqFlow(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  arg: string,
  sessionId: string,
): Promise<void> {
  const question = await resolveQuestion(ctx, arg, "Ask a follow-up question…");
  if (!question) return;

  const systemPrompt = buildQqSystemPrompt(ctx);
  const userMessage = buildQqResumeMessage(ctx, sessionId, question);
  await executeQq(pi, ctx, {
    mode: "resume",
    sessionId,
    question,
    systemPrompt,
    userMessage,
  });
}

/** Use the arg directly, or prompt the user to type a question. */
async function resolveQuestion(
  ctx: ExtensionCommandContext,
  arg: string,
  placeholder: string,
): Promise<string | null> {
  if (arg) return arg;
  const input = await ctx.ui.input("qq", placeholder);
  if (!input?.trim()) {
    ctx.ui.notify("Question required", "warning");
    return null;
  }
  return input.trim();
}

/** Run the subagent (new or resume), then persist + render the answer. */
async function executeQq(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  spec: QqRunSpec,
): Promise<void> {
  showLoadingWidget(ctx, spec.question);

  try {
    const details =
      spec.mode === "new"
        ? await runQq(pi, ctx, spec.systemPrompt, spec.userMessage)
        : await runQq(
            pi,
            ctx,
            spec.systemPrompt,
            spec.userMessage,
            spec.sessionId,
          );

    clearQqWidget(ctx);
    if (!details?.response) {
      ctx.ui.notify("No response generated", "warning");
      return;
    }

    const answerDetails: QqAnswerDetails = {
      id: crypto.randomUUID(),
      subagentSessionId:
        spec.mode === "resume" ? spec.sessionId : (details.sessionId ?? ""),
      question: spec.question,
      answer: details.response,
      createdAt: Date.now(),
      usage: details.usage,
      model: details.model,
    };

    pi.appendEntry<QqAnswerDetails>(QQ_ANSWER_TYPE, answerDetails);
    showResultWidget(ctx, answerDetails);
  } catch (err) {
    clearQqWidget(ctx);
    ctx.ui.notify(
      `qq error: ${err instanceof Error ? err.message : String(err)}`,
      "error",
    );
  }
}

/** New / Resume / (Display) picker. Returns null when cancelled. */
async function pickMode(
  ctx: ExtensionCommandContext,
  hasArg: boolean,
): Promise<QqMode | null> {
  return ctx.ui.custom<QqMode | null>(
    (_tui, theme, _kb, done) =>
      new QqModePicker(
        theme as Theme,
        (mode) => done(mode),
        () => done(null),
        !hasArg,
      ),
  );
}

/**
 * Pick a qq thread to resume. Fast-paths a single session. Returns null when
 * the picker is cancelled.
 */
async function pickResumeSession(
  ctx: ExtensionCommandContext,
  summaries: QqSessionSummary[],
): Promise<string | null> {
  if (summaries.length === 0) {
    ctx.ui.notify("No qq sessions to resume", "info");
    return null;
  }
  if (summaries.length === 1) {
    return summaries[0]?.sessionId ?? null;
  }
  return ctx.ui.custom<string | null>(
    (_tui, theme, _kb, done) =>
      new QqSessionPicker(
        summaries,
        theme as Theme,
        "resume",
        "latest",
        (sessionId) => done(sessionId),
      ),
  );
}

/** Open the browse-only Display overlay over the session. */
async function openDisplay(
  ctx: ExtensionCommandContext,
  summaries: QqSessionSummary[],
): Promise<void> {
  await ctx.ui.custom<"closed" | undefined>(
    (tui, theme, _kb, done) =>
      new QqDisplayOverlay({
        sessions: summaries,
        tui,
        theme: theme as Theme,
        onClose: () => done("closed"),
      }),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: "90%",
        maxHeight: "90%",
        margin: 2,
      },
    },
  );
}
