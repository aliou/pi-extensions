import type {
  EditToolDetails,
  EditToolInput,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { formatDisplayPath } from "@harness/utils";
import {
  buildEditCallComponent,
  type EditRenderContext,
  type EditRenderState,
  getCallComponent,
  renderEditResultComponent,
  statusFromContext,
} from "../shared/render";

export type DefaultEditRenderState = EditRenderState;

export function renderDefaultEditCall(
  args: EditToolInput,
  theme: Theme,
  context: EditRenderContext<EditToolInput>,
) {
  const component = getCallComponent(context.state, context.lastComponent);
  return buildEditCallComponent(
    component,
    "edit",
    formatDisplayPath(args.path, context.cwd),
    statusFromContext(context),
    theme,
  );
}

export function renderDefaultEditResult(
  result: {
    content: Array<{ type: string; text?: string }>;
    details?: EditToolDetails;
  },
  options: { expanded: boolean },
  theme: Theme,
  context: { isError: boolean; lastComponent?: Component },
) {
  return renderEditResultComponent(result, options, theme, context);
}
