import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createPiTestHarness } from "@harness/test-utils/pi-test-harness";
import { describe, expect, it, vi } from "vitest";
import setupLabelCommand from "./index";

describe("breadcrumbs /label command", () => {
  it("registers the label command", async () => {
    const pi = await createPiTestHarness(setupLabelCommand);
    expect(pi).toHaveRegisteredCommand("label");
  });

  it("labels the current leaf entry", async () => {
    const sm = SessionManager.inMemory();
    const entryId = sm.appendMessage({
      role: "user",
      content: "mark this point",
      timestamp: Date.now(),
    });
    const notify = vi.fn();

    const pi = await createPiTestHarness(setupLabelCommand, {
      context: {
        sessionManager: sm,
        ui: { notify },
      },
    });
    pi.runtime.setLabel = vi.fn(
      (targetId: string, label: string | undefined) => {
        sm.appendLabelChange(targetId, label);
      },
    );

    await pi.command("label").execute("checkpoint");

    expect(sm.getLabel(entryId)).toBe("checkpoint");
    expect(notify).toHaveBeenCalledWith("Label added: checkpoint", "info");
  });

  it("shows usage when no label text is provided", async () => {
    const notify = vi.fn();
    const pi = await createPiTestHarness(setupLabelCommand, {
      context: { ui: { notify } },
    });

    await pi.command("label").execute("   ");

    expect(notify).toHaveBeenCalledWith("Usage: /label <text>", "warning");
  });

  it("warns when there is no current leaf entry", async () => {
    const notify = vi.fn();
    const pi = await createPiTestHarness(setupLabelCommand, {
      context: {
        sessionManager: SessionManager.inMemory(),
        ui: { notify },
      },
    });

    await pi.command("label").execute("checkpoint");

    expect(notify).toHaveBeenCalledWith(
      "No current session entry to label",
      "warning",
    );
  });
});
