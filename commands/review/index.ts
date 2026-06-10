import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";
import { ExternalEditorComponent } from "@harness/ui";
import { err, isErr, ok, type Result, toError } from "@harness/utils";
import { openInSplit } from "./editor";
import { prepareDiffFile, resolveRange } from "./git";
import { renderReviewMessage } from "./render";
import {
  type CompletionItem,
  REVIEW_FLAGS,
  REVIEW_MESSAGE_TYPE,
} from "./types";
import { SplitReviewWaitingPanel } from "./waiting-panel";
import { appendReviewEntry, processAnnotatedDiff, removeDir } from "./workflow";

export default async function (pi: ExtensionAPI) {
  pi.registerMessageRenderer(REVIEW_MESSAGE_TYPE, renderReviewMessage);

  pi.registerCommand("review", {
    description:
      "Review a diff in nvim. Default: diff against the default branch.",
    getArgumentCompletions,
    handler: async (args, ctx) => {
      await runReviewCommand(pi, args, ctx, async (diffFile) => {
        const exitCode = await ctx.ui.custom(
          ExternalEditorComponent.create(diffFile),
        );

        return ok(exitCode);
      });
    },
  });

  pi.registerCommand("review-split", {
    description:
      "Review a diff in a tmux or Ghostty split. Default: diff against the default branch.",
    getArgumentCompletions,
    handler: async (args, ctx) => {
      await runReviewCommand(pi, args, ctx, (diffFile) =>
        ctx.ui.custom((tui, theme, _keybindings, done) => {
          const panel = new SplitReviewWaitingPanel(tui, theme);

          void openInSplit(diffFile, ctx.cwd)
            .then((result) => {
              panel.stop();
              done(result);
            })
            .catch((error: unknown) => {
              panel.stop();
              done(err(toError(error)));
            });

          return panel;
        }),
      );
    },
  });

  const offReview = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    offReview();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "review[-split]",
      description: "review diff in nvim or split",
    });
  });

  const offReviewSplit = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    offReviewSplit();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "review[-split]",
      description: "review diff in nvim or split",
    });
  });
}

type OpenReview = (diffFile: string) => Promise<Result<number | null, Error>>;

function getArgumentCompletions(prefix: string): CompletionItem[] | null {
  const filtered = REVIEW_FLAGS.filter((flag) => flag.value.startsWith(prefix));
  return filtered.length > 0 ? filtered : null;
}

async function runReviewCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
  openReview: OpenReview,
) {
  if (!ctx.hasUI) {
    ctx.ui.notify("review requires interactive mode", "error");
    return;
  }

  const prepared = await prepareReview(pi, args, ctx.cwd);
  if (isErr(prepared)) {
    ctx.ui.notify(prepared.error.message, "error");
    return;
  }

  const { diffFile, originalContent, range, tempDir } = prepared.value;

  try {
    const opened = await openReview(diffFile);
    if (isErr(opened)) {
      ctx.ui.notify(opened.error.message, "error");
      return;
    }

    if (opened.value !== 0) {
      ctx.ui.notify(
        `Editor exited with code ${opened.value}. Review cancelled`,
        "warning",
      );
      return;
    }

    const result = processAnnotatedDiff(pi, diffFile, originalContent, range);
    appendReviewEntry(pi, diffFile, range, result);
    const notification = formatReviewNotification(result);
    ctx.ui.notify(notification.message, notification.level);
  } finally {
    removeDir(tempDir);
  }
}

async function prepareReview(pi: ExtensionAPI, args: string, cwd: string) {
  const range = resolveRange(args, cwd);
  if (isErr(range)) return range;

  const prepared = await prepareDiffFile(pi, cwd, range.value);
  if (isErr(prepared)) return prepared;

  return ok({ ...prepared.value, range: range.value });
}

function formatReviewNotification(
  result: ReturnType<typeof processAnnotatedDiff>,
): { message: string; level: "info" | "warning" | "error" } {
  switch (result.status) {
    case "sent":
      return {
        message: `Sent ${result.comments.length} review comment(s) to the agent`,
        level: "info",
      };
    case "missing-file":
    case "unchanged":
      return { message: "No annotations found in the diff", level: "info" };
    case "no-comments":
      return {
        message:
          "No review comments detected. Add plain text lines to the diff",
        level: "info",
      };
  }
}
