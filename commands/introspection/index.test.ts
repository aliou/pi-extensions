import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import {
  createPiTestHarness,
  type PiTestHarness,
} from "@harness/test-utils/pi-test-harness";
import { NOOP_THEME } from "@harness/test-utils/theme";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntrospectPanel } from "./components/introspect-panel";
import introspectionExtension from "./index";

describe("introspection extension", () => {
  let pi: PiTestHarness;

  beforeEach(async () => {
    pi = await createPiTestHarness(introspectionExtension);
  });

  it("registers the /introspect command", () => {
    expect(pi).toHaveRegisteredCommand("introspect");
  });
});

describe("introspect command", () => {
  it("requires interactive mode", async () => {
    const notify = vi.fn() as unknown as ExtensionUIContext["notify"];

    const nonInteractivePi = await createPiTestHarness(introspectionExtension, {
      context: {
        hasUI: false,
        ui: { notify },
      },
    });

    await nonInteractivePi.command("introspect").execute("");

    expect(notify).toHaveBeenCalledWith(
      "introspect requires interactive mode",
      "error",
    );
  });

  it("opens custom panel with snapshot data", async () => {
    const notify = vi.fn() as unknown as ExtensionUIContext["notify"];
    const custom = vi.fn(
      async () => null,
    ) as unknown as ExtensionUIContext["custom"];

    const ctxPi = await createPiTestHarness(introspectionExtension, {
      context: {
        hasUI: true,
        ui: { notify, custom },
        getSystemPrompt: () => "Test system prompt",
      },
    });

    // Mock the runtime methods - use unknown cast to bypass strict typing
    ctxPi.runtime.getAllTools = vi.fn(
      () =>
        [
          {
            name: "read",
            description: "Read file",
            parameters: {},
            sourceInfo: {
              source: "builtin",
              path: "<builtin:read>",
              scope: "user" as const,
              origin: "package" as const,
            },
          },
        ] as unknown as ReturnType<typeof ctxPi.runtime.getAllTools>,
    );

    ctxPi.runtime.getActiveTools = vi.fn(() => ["read"]);

    ctxPi.runtime.getCommands = vi.fn(
      () =>
        [
          {
            name: "skill:test",
            description: "Test skill",
            source: "skill" as const,
            sourceInfo: {
              source: "skill",
              path: "/skills/test",
              scope: "user" as const,
              origin: "package" as const,
            },
          },
          {
            name: "my-prompt",
            description: "Prompt template",
            source: "prompt" as const,
            sourceInfo: {
              source: "prompt",
              path: "/prompts/my-prompt.md",
              scope: "user" as const,
              origin: "package" as const,
            },
          },
        ] as unknown as ReturnType<typeof ctxPi.runtime.getCommands>,
    );

    // Execute command - if it doesn't throw, the panel opened successfully
    await ctxPi.command("introspect").execute("");

    // Verify custom was called
    expect(custom).toHaveBeenCalled();
  });
});

describe("introspect panel", () => {
  it("renders with correct structure", () => {
    const snapshot = {
      systemPrompt: "Test prompt content\nSecond line",
      activeTools: ["read"],
      allTools: [
        {
          name: "read",
          description: "Read file contents",
          sourceInfo: {
            source: "builtin",
            path: "<builtin:read>",
            scope: "user" as const,
            origin: "package" as const,
          },
        },
      ],
      skills: [
        {
          name: "skill:test",
          description: "Test skill",
          source: "skill" as const,
          sourceInfo: {
            path: "/skills/test",
            source: "skill",
            scope: "user" as const,
            origin: "package" as const,
          },
        },
      ],
      prompts: [
        {
          name: "my-prompt",
          description: "My prompt template",
          source: "prompt" as const,
          sourceInfo: {
            path: "/prompts/my-prompt.md",
            source: "prompt",
            scope: "user" as const,
            origin: "package" as const,
          },
        },
      ],
    };

    const onClose = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: TUI mock is minimal for testing
    const panel = new IntrospectPanel({} as any, NOOP_THEME, snapshot, onClose);

    const lines = panel.render(80);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes("Introspect"))).toBe(true);
    expect(lines.some((l) => l.includes("System"))).toBe(true);
    expect(lines.some((l) => l.includes("Tools"))).toBe(true);
  });
});
