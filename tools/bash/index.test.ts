import type { BashSpawnContext } from "@earendil-works/pi-coding-agent";
import { createCommandContext } from "@harness/test-utils/pi-context";
import { createPiTestHarness } from "@harness/test-utils/pi-test-harness";
import { describe, expect, it, vi } from "vitest";
import setupBashTool from "./index";
import {
  AD_BASH_SPAWN_HOOK_REQUEST_EVENT,
  type SpawnHookRequestPayload,
} from "./types";

describe("bash tool spawn hooks", () => {
  it("notifies once after the first bash call when spawn hooks are installed", async () => {
    const notify = vi.fn();

    const pi = await createPiTestHarness((api) => {
      api.events.on(AD_BASH_SPAWN_HOOK_REQUEST_EVENT, (data) => {
        const payload = data as SpawnHookRequestPayload;
        payload.register({
          id: "test-hook",
          spawnHook: (ctx: BashSpawnContext) => ctx,
        });
      });
      setupBashTool(api);
    });

    const ctx = createCommandContext({ cwd: pi.cwd, ui: { notify } });
    const tool = pi.tool("bash").registered;

    await tool.execute(
      "tc_1",
      { command: "printf first" },
      undefined,
      undefined,
      ctx,
    );
    await tool.execute(
      "tc_2",
      { command: "printf second" },
      undefined,
      undefined,
      ctx,
    );

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      "Bash spawn hooks installed: test-hook",
      "info",
    );
  });

  it("does not notify when no spawn hooks are installed", async () => {
    const notify = vi.fn();
    const pi = await createPiTestHarness(setupBashTool);
    const ctx = createCommandContext({ cwd: pi.cwd, ui: { notify } });

    await pi
      .tool("bash")
      .registered.execute(
        "tc_1",
        { command: "printf no-hooks" },
        undefined,
        undefined,
        ctx,
      );

    expect(notify).not.toHaveBeenCalled();
  });
});
