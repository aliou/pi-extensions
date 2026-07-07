import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt";
import type { ArtisanParamsType } from "./types";

const params: ArtisanParamsType = {
  task: "Critique the settings page redesign.",
  context: "Users need to understand account sync state.",
  files: ["screenshots/settings.png", "src/SettingsPage.tsx"],
};

const ctx = {} as ExtensionContext;

describe("artisan prompt", () => {
  it("builds an outcome-first design prompt for GPT-5.5", () => {
    const result = buildPrompt(params, ctx, {
      provider: "openai-codex",
      id: "gpt-5.5",
    });

    expect(result.text).toContain(
      "outcome-first product/design advisory shape",
    );
    expect(result.text).toContain("strongest design judgment");
    expect(result.text).toContain(params.task);
    expect(result.text).toContain("- screenshots/settings.png");
  });

  it("builds a precise multimodal prompt for Kimi K2.7 Code", () => {
    const result = buildPrompt(params, ctx, {
      provider: "synthetic",
      id: "hf:moonshotai/Kimi-K2.7-Code",
    });

    expect(result.text).toContain("precise multimodal critique shape");
    expect(result.text).toContain("visible hierarchy, spacing, affordances");
    expect(result.text).toContain(params.task);
    expect(result.text).toContain("- src/SettingsPage.tsx");
  });
});
