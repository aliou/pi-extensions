/**
 * Enable Anthropic strict tool-use validation for the `edit` tool.
 *
 * Anthropic's `strict: true` compiles a tool's `input_schema` into a grammar
 * that constrains the model's output, so it cannot emit the malformed edit
 * arguments (e.g. stray empty-string `edits[]` entries) that the default edit
 * override otherwise has to sanitize.
 *
 * Strict mode requires every object schema to declare `additionalProperties:
 * false` and to list all properties in `required`. The native edit schema
 * (`{ path, edits[{oldText,newText}] }`) is strict-compatible; this helper
 * injects the missing `additionalProperties: false` and `required` arrays and
 * sets `strict: true` on the tool definition.
 *
 * Used from the `before_provider_request` hook in `index.ts` (Anthropic only).
 * Returns a new payload; never mutates the input.
 */

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
  [key: string]: unknown;
}

interface ToolLike {
  name?: string;
  strict?: boolean;
  input_schema?: JsonSchema;
  function?: { name?: string; parameters?: JsonSchema; strict?: boolean };
  [key: string]: unknown;
}

/** Recursively make an object/array JSON schema strict-compatible. */
function makeSchemaStrict(schema: JsonSchema): JsonSchema {
  const next: JsonSchema = { ...schema };

  if (next.type === "object" && next.properties) {
    next.additionalProperties = false;
    next.required = Object.keys(next.properties);
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => [
        key,
        makeSchemaStrict(value),
      ]),
    );
  }

  if (next.type === "array" && next.items) {
    next.items = makeSchemaStrict(next.items);
  }

  // Some schemas nest objects without an explicit `type: "object"`; walk
  // properties/items defensively so nested edit hunks still get tightened.
  if (next.properties) {
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => [
        key,
        makeSchemaStrict(value),
      ]),
    );
  }
  if (next.items) {
    next.items = makeSchemaStrict(next.items);
  }

  return next;
}

function tightenTool(tool: ToolLike): ToolLike {
  if (tool.input_schema) {
    return {
      ...tool,
      strict: true,
      input_schema: makeSchemaStrict(tool.input_schema),
    };
  }
  if (tool.function?.parameters) {
    return {
      ...tool,
      function: {
        ...tool.function,
        strict: true,
        parameters: makeSchemaStrict(tool.function.parameters),
      },
    };
  }
  return tool;
}

/**
 * Return a copy of `payload` with strict validation enabled on the `edit`
 * tool. If the edit tool is absent (e.g. Codex models use `apply_patch`
 * instead), the payload is returned unchanged.
 *
 * The edit tool is matched case-insensitively by name: Pi's Anthropic
 * provider renames built-in tools to their Claude Code canonical casing
 * (e.g. `edit` -> `Edit`) when using an OAuth token, so both spellings must
 * be accepted.
 */
function isEditToolName(name: string | undefined): boolean {
  return typeof name === "string" && name.toLowerCase() === "edit";
}

export function enableStrictOnEditTool(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as { tools?: ToolLike[] };
  if (!Array.isArray(p.tools) || p.tools.length === 0) return payload;

  const hasEdit = p.tools.some((t) => isEditToolName(t?.name));
  if (!hasEdit) return payload;

  return {
    ...p,
    tools: p.tools.map((t) => (isEditToolName(t?.name) ? tightenTool(t) : t)),
  };
}
