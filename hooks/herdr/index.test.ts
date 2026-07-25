import {
  createEventBus,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { AD_NOTIFY_DANGEROUS_EVENT } from "@harness/events";
import { describe, expect, it, vi } from "vitest";
import herdr from "./index";

const HERDR_BLOCKED_EVENT = "herdr:blocked";

function createMockPi(): ExtensionAPI {
  return {
    events: createEventBus(),
    on: vi.fn(),
  } as unknown as ExtensionAPI;
}

describe("herdr hook", () => {
  it("ignores Guardrails compatibility danger notifications", () => {
    const pi = createMockPi();
    const emit = vi.spyOn(pi.events, "emit");
    herdr(pi);

    pi.events.emit(AD_NOTIFY_DANGEROUS_EVENT, {
      source: "defaults:event-compat:guardrails",
      description: "recursive force delete",
    });

    expect(emit).not.toHaveBeenCalledWith(
      HERDR_BLOCKED_EVENT,
      expect.anything(),
    );
  });

  it("blocks on other dangerous notifications", () => {
    const pi = createMockPi();
    const emit = vi.spyOn(pi.events, "emit");
    herdr(pi);

    pi.events.emit(AD_NOTIFY_DANGEROUS_EVENT, {
      description: "Dangerous action detected",
      toolCallId: "tool-call-1",
    });

    expect(emit).toHaveBeenCalledWith(HERDR_BLOCKED_EVENT, {
      active: true,
      label: "Dangerous action detected",
    });
  });
});
