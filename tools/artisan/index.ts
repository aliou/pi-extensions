import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent, loadAgentsFilesFromCwd } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import {
  configuredSubagent,
  getSubagentModelPreferences,
} from "@harness/subagent-models";
import { ARTISAN_SYSTEM_PROMPT, buildPrompt } from "./prompt";
import {
  artisanToolRenderers,
  renderArtisanDetails,
  renderArtisanHeader,
} from "./render";
import { ArtisanParams } from "./types";

const tools: SubagentToolSpec[] = [
  { name: "read", type: "native", render: artisanToolRenderers.read },
  { name: "grep", type: "native", render: artisanToolRenderers.grep },
  { name: "find", type: "native", render: artisanToolRenderers.find },
  { name: "read_url", type: "native", render: artisanToolRenderers.read_url },
  {
    name: "find_sessions",
    type: "native",
    render: artisanToolRenderers.find_sessions,
  },
  {
    name: "read_session",
    type: "native",
    render: artisanToolRenderers.read_session,
  },
  {
    name: "synthetic_web_search",
    type: "native",
    render: artisanToolRenderers.synthetic_web_search,
  },
];

const extensionPaths = ["./tools", "npm:@aliou/pi-synthetic"];

export default async function artisan(pi: ExtensionAPI): Promise<void> {
  const subagent = createSubagent(pi, {
    name: "artisan",
    modelPreferences: () => getSubagentModelPreferences("artisan"),
    label: "Artisan",
    description:
      "Zero-shot product design and frontend craft advisor. Give the UI goal, users, constraints, files/screenshots, and the concrete design decision you need.",
    promptSnippet:
      "Design-focused advisor for UX critique, product polish, visual hierarchy, accessibility, design-system fit, and frontend craft.",
    promptGuidelines: [
      "artisan: Use for design-heavy plans, UI/UX critique, product polish, visual hierarchy, interaction states, design-system fit, accessibility, and frontend craft guidance.",
      "artisan: Use alongside oracle when the same task needs both product/interface judgment and engineering architecture review; do not use for simple lookups or pure backend architecture.",
      "artisan: Make the task self-contained: include product outcome, users, what good means, current UI/problem, constraints, check signal, and desired deliverable.",
      "artisan: Pass screenshots, mockups, and relevant component/style files in files; ask for prioritized recommendations covering hierarchy, interaction states, accessibility, and frontend steps.",
      "artisan: For screenshot-heavy work, give a precise visual objective, what visible evidence to inspect, what to ignore, and the expected output format.",
    ],
    systemPrompt: ARTISAN_SYSTEM_PROMPT,
    parameters: ArtisanParams,
    resumable: true,
    renderHeader: renderArtisanHeader,
    renderDetails: renderArtisanDetails,
    buildPrompt,
    resolveAgentsFiles: (_params, ctx) => loadAgentsFilesFromCwd(ctx.cwd),
    tools,
    extensionPaths,
  });

  await subagent.ready;
  const { register, notifyOnSessionStart } = configuredSubagent(
    pi,
    "artisan",
    "Artisan",
    subagent,
    subagent.configured,
  );
  register();
  notifyOnSessionStart();
}
