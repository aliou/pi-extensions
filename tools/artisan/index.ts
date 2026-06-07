import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { MODEL_CANDIDATES } from "./models";
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
      "Design-focused subagent for UI/UX plans, product polish, visual hierarchy, interaction design, accessibility, design-system fit, and practical frontend implementation guidance.",
    promptGuidelines: [
      "artisan: Use for design-heavy plans, UI/UX critique, product polish, visual hierarchy, interaction states, design-system fit, accessibility, and frontend craft guidance.",
      "artisan: Use alongside oracle when the same task needs both product/interface judgment and engineering architecture review.",
      "artisan: Do not use for simple lookups, pure backend architecture, or file reads -- use read/grep/find or oracle instead.",
    ],
    systemPrompt: ARTISAN_SYSTEM_PROMPT,
    parameters: ArtisanParams,
    resumable: true,
    renderHeader: renderArtisanHeader,
    renderDetails: renderArtisanDetails,
    buildPrompt,
    tools,
    extensionPaths,
    models: MODEL_CANDIDATES,
  });

  subagent.register();
}
