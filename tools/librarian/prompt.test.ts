import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt";
import type { LibrarianParamsType } from "./types";

const params: LibrarianParamsType = {
  query: "Compare the plugin lifecycle in two repositories.",
  context: "Use only the main branches and cite implementation paths.",
};

const ctx = {} as ExtensionContext;

describe("librarian prompt", () => {
  it("builds a bounded cross-repository prompt for GLM-5.2", () => {
    const result = buildPrompt(params, ctx, {
      provider: "neuralwatt",
      id: "glm-5.2",
    });

    expect(result.text).toContain("bounded cross-repository research task");
    expect(result.text).toContain("explicit gaps");
    expect(result.text).toContain(params.query);
    expect(result.text).toContain(params.context);
  });

  it("uses the generic prompt for unknown models", () => {
    const result = buildPrompt(params, ctx, {
      provider: "anthropic",
      id: "claude-opus-4-8",
    });

    expect(result.text).not.toContain("bounded cross-repository research task");
    expect(result.text).toContain(params.query);
  });
});
