import { describe, expect, it } from "vitest";

import { enableStrictOnEditTool } from "./strict";

/**
 * Build a tool object shaped like Pi's Anthropic `convertTools` output
 * (packages/ai/src/api/anthropic-messages.ts): `{ name, description,
 * input_schema: { type, properties, required } }`. Pi does NOT set
 * `additionalProperties` itself; strict mode requires it.
 */
function anthropicTool(
  name: string,
  properties: Record<string, unknown>,
  required: string[],
) {
  return {
    name,
    description: "desc",
    input_schema: {
      type: "object",
      properties,
      required,
    },
  };
}

const EDIT_PROPERTIES = {
  path: { type: "string", description: "p" },
  edits: {
    type: "array",
    items: {
      type: "object",
      properties: {
        oldText: { type: "string" },
        newText: { type: "string" },
      },
      required: ["oldText", "newText"],
    },
  },
};

describe("enableStrictOnEditTool", () => {
  it("adds strict:true and additionalProperties:false to the edit tool and its nested schema", () => {
    const payload = {
      model: "claude-opus-4-8",
      tools: [
        anthropicTool("edit", EDIT_PROPERTIES, ["path", "edits"]),
        anthropicTool("bash", { command: { type: "string" } }, ["command"]),
      ],
    };

    const result = enableStrictOnEditTool(payload) as {
      tools: Array<
        Record<string, unknown> & {
          input_schema: {
            additionalProperties?: boolean;
            required?: string[];
            properties: {
              edits?: {
                items?: { additionalProperties?: boolean; required?: string[] };
              };
            };
          };
        }
      >;
    };

    const edit = result.tools[0];
    if (!edit) throw new Error("edit tool missing");
    expect(edit.strict).toBe(true);
    // Top-level input_schema tightened.
    expect(edit.input_schema.additionalProperties).toBe(false);
    expect(edit.input_schema.required).toEqual(["path", "edits"]);
    // Nested edit-item schema tightened too.
    const itemSchema = edit.input_schema.properties.edits?.items;
    if (!itemSchema) throw new Error("nested item schema missing");
    expect(itemSchema.additionalProperties).toBe(false);
    expect(itemSchema.required).toEqual(["oldText", "newText"]);
  });

  it("leaves non-edit tools untouched", () => {
    const payload = {
      tools: [
        anthropicTool("bash", { command: { type: "string" } }, ["command"]),
      ],
    };
    const result = enableStrictOnEditTool(payload) as { tools: unknown[] };
    expect(result.tools[0]).toEqual(payload.tools[0]);
  });

  it("matches the edit tool case-insensitively (OAuth Claude Code rename -> Edit)", () => {
    const payload = {
      tools: [anthropicTool("Edit", EDIT_PROPERTIES, ["path", "edits"])],
    };
    const result = enableStrictOnEditTool(payload) as {
      tools: Array<{ name: string; strict?: boolean }>;
    };
    const edit = result.tools[0];
    expect(edit?.strict).toBe(true);
  });

  it("returns the payload unchanged when there is no edit tool", () => {
    const payload = {
      tools: [
        anthropicTool("apply_patch", { input: { type: "string" } }, ["input"]),
      ],
    };
    expect(enableStrictOnEditTool(payload)).toBe(payload);
  });

  it("is a no-op for non-object payloads", () => {
    expect(enableStrictOnEditTool(null)).toBe(null);
    expect(enableStrictOnEditTool(undefined)).toBe(undefined);
    expect(enableStrictOnEditTool("str")).toBe("str");
  });

  it("does not mutate the input payload", () => {
    const payload = {
      tools: [anthropicTool("edit", EDIT_PROPERTIES, ["path", "edits"])],
    };
    const original = JSON.parse(JSON.stringify(payload));
    enableStrictOnEditTool(payload);
    expect(payload).toEqual(original);
  });
});
