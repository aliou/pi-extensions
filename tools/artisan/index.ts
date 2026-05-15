import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { MODEL_CANDIDATES } from "./models";
import { ARTISAN_SYSTEM_PROMPT, buildPrompt } from "./prompt";
import { ArtisanParams } from "./types";

const tools: SubagentToolSpec[] = [
  { name: "read", type: "native" },
  { name: "grep", type: "native" },
  { name: "find", type: "native" },
  { name: "read_url", type: "native" },
  { name: "find_sessions", type: "native" },
  { name: "read_session", type: "native" },
  { name: "synthetic_web_search", type: "native" },
];

const extensionPaths = [
  "./tools",
  "./extensions/breadcrumbs",
  "npm:@aliou/pi-synthetic",
];

export default async function artisan(pi: ExtensionAPI): Promise<void> {
  const subagent = defineSubagent(pi, {
    name: "artisan",
    label: "Artisan",
    description:
      "Design-focused subagent for UI/UX plans, product polish, visual hierarchy, interaction design, accessibility, design-system fit, and practical frontend implementation guidance.",
    promptGuidelines: [
      "artisan: Use for design-heavy plans, UI/UX critique, product polish, visual hierarchy, interaction states, design-system fit, accessibility, and frontend craft guidance.",
      "artisan: Use alongside oracle when the same task needs both product/interface judgment and engineering architecture review.",
      "artisan: Do not use for simple lookups, pure backend architecture, or file reads -- use read/grep/find or oracle instead.",
    ],
    systemPrompt: ARTISAN_SYSTEM_PROMPT,
    parameters: ArtisanParams,
    buildPrompt,
    tools,
    extensionPaths,
    models: MODEL_CANDIDATES,
  });

  subagent.subscribe(pi);

  pi.registerTool(subagent.tool);
  pi.registerTool(subagent.resumeTool);
}
