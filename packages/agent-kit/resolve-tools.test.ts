import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveCwd, resolveTools } from "@harness/agent-kit";
import type {
  SubagentCwdResolver,
  SubagentToolSpec,
  SubagentToolsResolver,
} from "@harness/agent-kit/types";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";

const Params = Type.Object({ mode: Type.String() });

const nativeTool: SubagentToolSpec = { name: "read", type: "native" };
const stubCtx = { cwd: "/repo" } as ExtensionContext;

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

describe("resolveCwd", () => {
  it("returns undefined without a resolver", async () => {
    const result = await resolveCwd(undefined, { mode: "a" }, stubCtx);

    expect(result).toBeUndefined();
  });

  it("uses a sync cwd resolver", async () => {
    const resolver: SubagentCwdResolver<typeof Params> = (params, ctx) =>
      `${ctx.cwd}/${params.mode}`;

    const result = await resolveCwd(resolver, { mode: "child" }, stubCtx);

    expect(result).toBe("/repo/child");
  });

  it("uses an async cwd resolver", async () => {
    const result = await resolveCwd(
      async () => "/other/repo",
      { mode: "async" },
      stubCtx,
    );

    expect(result).toBe("/other/repo");
  });
});
