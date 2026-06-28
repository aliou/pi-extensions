import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveTools } from "@harness/agent-kit";
import type {
  SubagentToolSpec,
  SubagentToolsResolver,
} from "@harness/agent-kit/types";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";

const Params = Type.Object({ mode: Type.String() });

const nativeTool: SubagentToolSpec = { name: "read", type: "native" };
const stubCtx = {} as ExtensionContext;

describe("resolveTools", () => {
  it("returns a static tool list as-is", async () => {
    const tools: SubagentToolSpec[] = [nativeTool];

    const result = await resolveTools(tools, { mode: "a" }, stubCtx);

    expect(result).toBe(tools);
  });

  it("resolves a sync tools resolver", async () => {
    const resolver: SubagentToolsResolver<typeof Params> = (params) =>
      params.mode === "include" ? [nativeTool] : [];

    const result = await resolveTools(resolver, { mode: "include" }, stubCtx);

    expect(result).toEqual([nativeTool]);
  });

  it("resolves an async tools resolver", async () => {
    const resolver: SubagentToolsResolver<typeof Params> = async () => [
      nativeTool,
    ];

    const result = await resolveTools(resolver, { mode: "async" }, stubCtx);

    expect(result).toEqual([nativeTool]);
  });

  it("forwards params and ctx to the resolver", async () => {
    let received: { params: unknown; ctx: ExtensionContext } | undefined;
    const resolver: SubagentToolsResolver<typeof Params> = (params, ctx) => {
      received = { params, ctx };
      return [nativeTool];
    };

    await resolveTools(resolver, { mode: "z" }, stubCtx);

    expect(received?.params).toEqual({ mode: "z" });
    expect(received?.ctx).toBe(stubCtx);
  });
});
