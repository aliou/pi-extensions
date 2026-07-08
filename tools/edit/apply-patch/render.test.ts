import { initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { beforeAll, describe, expect, it } from "vitest";
import { renderApplyPatchCall, renderApplyPatchResult } from "./render";

const plainTheme = {
  fg: (_name: string, text: string) => text,
  bg: (_name: string, text: string) => text,
  bold: (text: string) => text,
  inverse: (text: string) => text,
} as Theme;

describe("apply_patch result rendering", () => {
  beforeAll(() => {
    initTheme("dark", false);
  });

  const result = {
    content: [{ type: "text", text: "Success" }],
    details: {
      patch: "*** Begin Patch\n*** Update File: app.ts\n*** End Patch",
      summary: ["M app.ts"],
      fileDiffs: [
        {
          status: "M" as const,
          path: "app.ts",
          diff: "-1 old line\n+1 new line",
        },
      ],
      diff: "app.ts\n-1 old line\n+1 new line",
    },
  };

  it("shows file summary when collapsed", () => {
    const component = renderApplyPatchResult(
      result,
      { expanded: false },
      plainTheme,
      { isError: false },
    );
    const output = component.render(120).join("\n");

    expect(output).toContain("M  app.ts");
    expect(output).not.toContain("old line");
    expect(output).not.toContain("new line");
  });

  it("shows diff when expanded", () => {
    const component = renderApplyPatchResult(
      result,
      { expanded: true },
      plainTheme,
      { isError: false },
    );
    const output = component.render(120).join("\n");

    expect(output).toContain("app.ts");
    expect(output).toContain("old line");
    expect(output).toContain("new line");
  });
});

describe("apply_patch call rendering", () => {
  it("shows the first three files and hidden counts", () => {
    const component = renderApplyPatchCall(
      {
        input:
          "*** Begin Patch\n" +
          "*** Update File: one.ts\n" +
          "*** Update File: two.ts\n" +
          "*** Add File: three.ts\n" +
          "*** Update File: four.ts\n" +
          "*** Add File: five.ts\n" +
          "*** End Patch",
      },
      plainTheme,
      {
        args: {},
        cwd: "/tmp",
        state: {},
        isError: false,
        isPartial: false,
      },
    );
    const output = component.render(120).join("\n");

    expect(output).toContain("M one.ts");
    expect(output).toContain("M two.ts");
    expect(output).toContain("A three.ts");
    expect(output).not.toContain("four.ts");
    expect(output).not.toContain("five.ts");
    expect(output).toContain("+ 1 updated");
    expect(output).toContain("+ 1 created");
  });
});
