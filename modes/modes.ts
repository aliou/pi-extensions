import { getModeToolOverride } from "@modes/config";
import type { ModeColor } from "@packages/events";

export type ToolAccess = "enabled" | "disabled" | "confirm";

export interface ToolPolicyRule {
  access: ToolAccess;
  allowSession?: boolean;
}

export interface ModeToolPolicy {
  nativeDefault: ToolPolicyRule;
  extensionDefault: ToolPolicyRule;
  native: Record<string, ToolPolicyRule>;
  extension: Record<string, ToolPolicyRule>;
}

export interface ModeDefinition {
  name: string;
  label: string;
  labelColor: ModeColor;
  toolPolicy: ModeToolPolicy;
  provider?: string;
  model?: string;
  instructions?: string;
}

export const BUILTIN_TOOL_NAMES = new Set([
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
]);

function isBuiltinTool(toolName: string): boolean {
  return BUILTIN_TOOL_NAMES.has(toolName);
}

function normalizeRule(rule: ToolPolicyRule): ToolPolicyRule {
  if (rule.access !== "confirm") {
    return { access: rule.access };
  }

  return {
    access: "confirm",
    allowSession: rule.allowSession ?? true,
  };
}

export function resolveToolPolicy(
  mode: ModeDefinition,
  toolName: string,
): ToolPolicyRule {
  const isBuiltin = isBuiltinTool(toolName);
  const modeRule = isBuiltin
    ? mode.toolPolicy.native[toolName]
    : mode.toolPolicy.extension[toolName];

  const baseRule = normalizeRule(
    modeRule ??
      (isBuiltin
        ? mode.toolPolicy.nativeDefault
        : mode.toolPolicy.extensionDefault),
  );

  const override = getModeToolOverride(mode.name);
  if (override.deny.has(toolName)) {
    return { access: "disabled" };
  }

  if (override.allow.has(toolName)) {
    return { access: "enabled" };
  }

  return baseRule;
}

export const MODE_ORDER: string[] = ["default", "research"];

const RESEARCH_INSTRUCTIONS = [
  "You are in RESEARCH MODE.",
  "",
  "Rules:",
  "- Do not modify files or system state.",
  "- Use read + grep/find/ls for local code exploration.",
  "- Prefer deep exploration and evidence-backed findings.",
  "",
  "Output clear findings with sources, assumptions, and open questions.",
].join("\n");

export const MODES: Record<string, ModeDefinition> = {
  default: {
    name: "default",
    label: "default",
    labelColor: { source: "theme", color: "thinkingMinimal" },
    toolPolicy: {
      nativeDefault: { access: "disabled" },
      extensionDefault: { access: "enabled" },
      native: {
        read: { access: "enabled" },
        bash: { access: "enabled" },
        edit: { access: "enabled" },
        write: { access: "enabled" },
      },
      extension: {
        "mode.switch": { access: "enabled" },
      },
    },
  },
  research: {
    name: "research",
    label: "research",
    labelColor: { source: "theme", color: "accent" },
    toolPolicy: {
      nativeDefault: { access: "disabled" },
      extensionDefault: { access: "confirm", allowSession: true },
      native: {
        read: { access: "enabled" },
        ls: { access: "enabled" },
        find: { access: "enabled" },
        grep: { access: "enabled" },
        bash: { access: "confirm", allowSession: false },
        write: { access: "disabled" },
        edit: { access: "disabled" },
      },
      extension: {
        "subagent.worker": { access: "disabled" },
        process: { access: "disabled" },
        "mode.switch": { access: "enabled" },
      },
    },
    provider: "anthropic",
    model: "claude-opus-4-6",
    instructions: RESEARCH_INSTRUCTIONS,
  },
};

export const DEFAULT_MODE: ModeDefinition = MODES.default as ModeDefinition;
