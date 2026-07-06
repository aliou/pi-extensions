import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
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
    label: "Artisan",
    description:
      "Zero-shot product design and frontend craft advisor. Give the UI goal, users, constraints, files/screenshots, and the concrete design decision you need.",
    promptSnippet:
      "Design-focused advisor for UX critique, product polish, visual hierarchy, accessibility, design-system fit, and frontend craft.",
    promptGuidelines: [
      "artisan: Use for design-heavy plans, UI/UX critique, product polish, visual hierarchy, interaction states, design-system fit, accessibility, and frontend craft guidance.",
      "artisan: Use alongside oracle when the same task needs both product/interface judgment and engineering architecture review.",
      "artisan: Do not use for simple lookups, pure backend architecture, or file reads -- use read/grep/find or oracle instead.",
      "artisan: GPT-5.5 works best with outcome-first prompts. State the product outcome, what good means for the user, constraints, how the result can be checked, available evidence, and desired deliverable; do not over-prescribe critique steps unless required.",
      "artisan: GPT-5.5 is literal about product judgment. Give a checkable target and say what evidence would make the design advice useful; avoid vague prompts like 'make this better'.",
      "artisan: Make the task self-contained: include the product goal, target users, current UI/problem, design-system constraints, device/responsive needs, and desired output.",
      "artisan: Pass screenshots, mockups, and relevant component/style files in files; put product background, prior feedback, and acceptance criteria in context.",
      "artisan: Ask for prioritized, implementable recommendations covering interaction states, accessibility, visual hierarchy, and frontend steps; avoid vague prompts like 'make it nicer'.",
      "artisan: For screenshot-heavy work, give a precise visual objective and expected output; Kimi fallback is multimodal and performs best when told what visible evidence to inspect.",
    ],
    systemPrompt: ARTISAN_SYSTEM_PROMPT,
    parameters: ArtisanParams,
    resumable: true,
    renderHeader: renderArtisanHeader,
    renderDetails: renderArtisanDetails,
    buildPrompt,
    tools,
    extensionPaths,
    // Primary: gpt-5.5 at medium (vision-capable; sees screenshots natively).
    // Fallback: synthetic Kimi-K2.7-Code (vision) so artisan keeps image input
    // when openai-codex is down. GLM-5.2 is text-only and would blind artisan's
    // screenshot analysis on fallback, so Kimi is used here instead of the
    // GLM-5.2 fallback that oracle/reviewer use. Kimi-K2.7-Code is thinking-only:
    // "low" clamps to "medium" (its sole level). ~9% bleed at weight 0.1.
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.5",
        thinking: "medium",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "hf:moonshotai/Kimi-K2.7-Code",
        thinking: "low",
        weight: 0.1,
      },
    ],
  });

  subagent.register();
}
