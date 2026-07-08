import type { Theme } from "@earendil-works/pi-coding-agent";
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
import type { KimiEditDetails, KimiEditInput } from "./edit";

export type KimiEditRenderState = EditRenderState;

export function renderKimiEditCall(
  args: KimiEditInput,
  theme: Theme,
  context: EditRenderContext<KimiEditInput>,
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

export function renderKimiEditResult(
  result: {
    content: Array<{ type: string; text?: string }>;
    details?: KimiEditDetails;
  },
  options: { expanded: boolean },
  theme: Theme,
  context: { isError: boolean; lastComponent?: Component },
) {
  return renderEditResultComponent(result, options, theme, context);
}
