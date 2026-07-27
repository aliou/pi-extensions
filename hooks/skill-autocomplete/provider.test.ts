import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import { expect, test } from "vitest";
import { createSkillAutocompleteEditor } from "./editor";
import { expandSkillReferences } from "./expand";
import { createSkillAutocompleteProvider, extractSkillToken } from "./provider";
import { listSkills, type SkillsRoot } from "./skills";

const current = {
  getSuggestions: async () => null,
  applyCompletion: () => ({ lines: [], cursorLine: 0, cursorCol: 0 }),
} as AutocompleteProvider;

test("recognizes ?? as the force-show skill trigger", () => {
  expect(extractSkillToken("??")).toEqual({ trigger: "??", token: "" });
  expect(extractSkillToken("?vit")).toEqual({ trigger: "?", token: "vit" });
});

test("shows all skills for ??", async () => {
  const root = mkdtempSync(join(tmpdir(), "skill-autocomplete-"));
  mkdirSync(join(root, "alpha"));
  mkdirSync(join(root, "beta"));
  writeFileSync(
    join(root, "alpha", "SKILL.md"),
    "---\nname: alpha\ndescription: Alpha skill description\n---\n\nalpha instructions",
  );
  writeFileSync(
    join(root, "beta", "SKILL.md"),
    "---\nname: beta\ndescription: Beta skill description\n---\n\nbeta instructions",
  );

  try {
    const roots: SkillsRoot[] = [{ path: root, label: "test" }];
    const provider = createSkillAutocompleteProvider(current, roots);
    const suggestions = await provider.getSuggestions(["??"], 0, 2, {
      signal: new AbortController().signal,
    });

    expect(suggestions).toMatchObject({
      prefix: "??",
      items: [
        { label: "alpha", description: "[test] Alpha skill description" },
        { label: "beta", description: "[test] Beta skill description" },
      ],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("expands multiple skills and retains their names in prose", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-autocomplete-"));
  mkdirSync(join(root, "documentation"));
  mkdirSync(join(root, "ark-ui"));
  writeFileSync(
    join(root, "documentation", "SKILL.md"),
    "---\nname: documentation\ndescription: Write docs\n---\n\nDocumentation instructions.",
  );
  writeFileSync(
    join(root, "ark-ui", "SKILL.md"),
    "---\nname: ark-ui\ndescription: Use Ark UI\n---\n\nArk UI instructions.",
  );

  try {
    const roots: SkillsRoot[] = [{ path: root, label: "test" }];
    const result = expandSkillReferences(
      "read the ??documentation skill and the ??ark-ui skill",
      listSkills(roots),
    );

    expect(result.skills.map((skill) => skill.name)).toEqual([
      "documentation",
      "ark-ui",
    ]);
    expect(result.skills[0]?.xml).toContain(
      '<skill name="documentation" location="',
    );
    expect(result.skills[1]?.xml).toContain('<skill name="ark-ui" location="');
    expect(result.prose).toBe(
      "read the documentation skill and the ark-ui skill",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not partially expand a longer unknown reference", () => {
  const skills = [
    {
      name: "foo",
      fullPath: "/tmp/foo/SKILL.md",
      baseDir: "/tmp/foo",
      directory: "/tmp/foo",
      sourceLabel: "test",
    },
  ];

  expect(expandSkillReferences("use ?foo_bar", skills)).toEqual({
    prose: "use ?foo_bar",
    skills: [],
  });
});

test("requests completion when the second ? is typed", async () => {
  const calls: string[] = [];
  const editor = createSkillAutocompleteEditor(
    { requestRender: () => {} } as never,
    { borderColor: (text: string) => text, selectList: {} } as never,
    { matches: () => false } as never,
  );
  editor.setAutocompleteProvider({
    triggerCharacters: ["?"],
    getSuggestions: async (lines) => {
      calls.push(lines.join("\n"));
      return null;
    },
    applyCompletion: () => ({ lines: [""], cursorLine: 0, cursorCol: 0 }),
  });

  editor.handleInput("?");
  await new Promise((resolve) => setTimeout(resolve, 30));
  editor.handleInput("?");
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(calls).toEqual(["?", "??"]);
});
