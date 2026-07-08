import { renderDiff, type Theme } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  Container,
  Spacer,
  Text,
} from "@earendil-works/pi-tui";
import {
  type EditRenderContext,
  type EditRenderState,
  extractTextOutput,
  getCallComponent,
} from "../shared/render";
import type { ApplyPatchDetails } from "./tool";

export type ApplyPatchRenderState = EditRenderState;

export function extractFileOps(patch: string): string[] {
  return extractFileOpDetails(patch).map((op) => `${op.status} ${op.path}`);
}

interface FileOpSummary {
  status: "A" | "D" | "M";
  path: string;
}

function extractFileOpDetails(patch: string): FileOpSummary[] {
  const ops: FileOpSummary[] = [];
  const re = /^\*\*\* (Add|Delete|Update) File: (.+)$/gm;
  let match = re.exec(patch);
  while (match !== null) {
    const action = match[1] ?? "Update";
    const path = match[2] ?? "";
    const verb = action === "Add" ? "A" : action === "Delete" ? "D" : "M";
    ops.push({ status: verb, path });
    match = re.exec(patch);
  }
  return ops;
}

export function renderApplyPatchCall(
  args: { input?: string },
  theme: Theme,
  context: EditRenderContext<{ input?: string }>,
) {
  const ops = extractFileOpDetails(args.input ?? "");
  const detail = formatCallSummary(ops, theme);
  const component = getCallComponent(context.state, context.lastComponent);
  component.setText(
    `${theme.fg("toolTitle", theme.bold("apply_patch"))} ${detail}`,
  );
  return component;
}

export function renderApplyPatchResult(
  result: {
    content: Array<{ type: string; text?: string }>;
    details?: ApplyPatchDetails;
  },
  options: { expanded: boolean },
  theme: Theme,
  context: { isError: boolean; lastComponent?: Component },
) {
  const component = (
    context.lastComponent instanceof Container
      ? context.lastComponent
      : new Container()
  ) as Container;
  component.clear();

  const output = context.isError
    ? theme.fg("error", extractTextOutput(result))
    : options.expanded
      ? formatExpandedDiff(result.details, theme)
      : formatApplyPatchSummary(result.details?.summary, theme);

  if (!output) return component;

  component.addChild(new Spacer(1));
  component.addChild(new Text(output, 0, 0));
  return component;
}

function formatApplyPatchSummary(
  summary: string[] | undefined,
  theme: Theme,
): string | undefined {
  if (!summary || summary.length === 0) return undefined;
  return summary.map((line) => formatSummaryLine(line, theme)).join("\n");
}

function formatSummaryLine(line: string, theme: Theme): string {
  const { status, path } = splitSummaryLine(line);
  return `${formatStatus(status, theme)}  ${theme.fg("toolOutput", path)}`;
}

function formatExpandedDiff(
  details: ApplyPatchDetails | undefined,
  theme: Theme,
): string | undefined {
  if (!details) return undefined;
  const fileDiffs =
    details.fileDiffs && details.fileDiffs.length > 0
      ? details.fileDiffs
      : parseFileDiffs(details.diff, details.summary);
  if (fileDiffs.length === 0) {
    return details.diff ? renderDiff(details.diff) : undefined;
  }
  return fileDiffs
    .map(
      (fileDiff) =>
        `${formatExpandedPath(fileDiff.path, theme)}\n${renderDiff(fileDiff.diff)}`,
    )
    .join("\n\n");
}

function formatExpandedPath(path: string, theme: Theme): string {
  return theme.fg("accent", theme.bold(path));
}

function parseFileDiffs(
  diff: string | undefined,
  summary: string[] | undefined,
): Array<{ status: "A" | "M" | "D"; path: string; diff: string }> {
  if (!diff) return [];
  const statuses = new Map(
    (summary ?? []).map((line) => {
      const { status, path } = splitSummaryLine(line);
      return [path, status === "A" || status === "D" ? status : "M"] as const;
    }),
  );

  return diff
    .split(/\n\n+/)
    .map((section) => {
      const [path, ...lines] = section.split("\n");
      if (!path || lines.length === 0) return undefined;
      return {
        status: statuses.get(path) ?? "M",
        path,
        diff: lines.join("\n"),
      };
    })
    .filter((fileDiff) => fileDiff !== undefined);
}

function formatCallSummary(ops: FileOpSummary[], theme: Theme): string {
  if (ops.length === 0) return theme.fg("dim", "V4A patch");

  const visible = ops.slice(0, 3).map((op) => formatCallOp(op, theme));
  const hidden = ops.slice(3);
  if (hidden.length === 0) return visible.join("  ");

  return `${visible.join("  ")} ${theme.fg("dim", `(${formatHiddenCounts(hidden).join(", ")})`)}`;
}

function formatCallOp(op: FileOpSummary, theme: Theme): string {
  return `${formatStatus(op.status, theme)} ${theme.fg("accent", op.path)}`;
}

function formatHiddenCounts(ops: FileOpSummary[]): string[] {
  const updated = ops.filter((op) => op.status === "M").length;
  const created = ops.filter((op) => op.status === "A").length;
  const deleted = ops.filter((op) => op.status === "D").length;
  const parts: string[] = [];
  if (updated > 0) parts.push(formatHiddenCount(updated, "updated"));
  if (created > 0) parts.push(formatHiddenCount(created, "created"));
  if (deleted > 0) parts.push(formatHiddenCount(deleted, "deleted"));
  return parts;
}

function formatHiddenCount(count: number, label: string): string {
  return `+ ${count} ${label}`;
}

function splitSummaryLine(line: string): { status: string; path: string } {
  const match = line.match(/^([^ ]+)\s+(.+)$/);
  if (!match) return { status: "M", path: line };
  return { status: match[1] ?? "M", path: match[2] ?? "" };
}

function formatStatus(status: string, theme: Theme): string {
  if (status === "A") return theme.fg("success", status);
  if (status === "D") return theme.fg("error", status);
  if (status === "O") return theme.fg("warning", status);
  if (status === "M") return theme.fg("warning", status);
  return theme.fg("accent", status);
}
