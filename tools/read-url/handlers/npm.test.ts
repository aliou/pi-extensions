import { describe, expect, it } from "vitest";
import type { NpmMetadata } from "./npm";
import { buildNpmMarkdown, parseNpmUrl } from "./npm";

describe("npm read_url handler", () => {
  describe("parseNpmUrl", () => {
    it("parses scoped package URLs", () => {
      const parsed = parseNpmUrl(
        new URL("https://www.npmjs.com/package/@golevelup/ts-vitest"),
      );

      expect(parsed).toEqual({
        packageName: "@golevelup/ts-vitest",
      });
    });

    it("parses unscoped package URLs", () => {
      const parsed = parseNpmUrl(
        new URL("https://www.npmjs.com/package/lodash"),
      );
      expect(parsed).toEqual({ packageName: "lodash" });
    });

    it("parses scoped package URLs with versions", () => {
      const parsed = parseNpmUrl(
        new URL("https://www.npmjs.com/package/@golevelup/ts-vitest/v/4.0.0"),
      );

      expect(parsed).toEqual({
        packageName: "@golevelup/ts-vitest",
        version: "4.0.0",
      });
    });

    it("parses unscoped package URLs with versions", () => {
      const parsed = parseNpmUrl(
        new URL("https://www.npmjs.com/package/lodash/v/4.17.21"),
      );

      expect(parsed).toEqual({
        packageName: "lodash",
        version: "4.17.21",
      });
    });

    it("accepts npmjs.com without the www prefix", () => {
      const parsed = parseNpmUrl(
        new URL("https://npmjs.com/package/@scope/pkg"),
      );

      expect(parsed).toEqual({ packageName: "@scope/pkg" });
    });

    it("decodes URL-encoded package names", () => {
      const parsed = parseNpmUrl(
        new URL("https://www.npmjs.com/package/@scope%2Fpkg"),
      );

      expect(parsed).toEqual({ packageName: "@scope/pkg" });
    });

    it("rejects non-npmjs hosts", () => {
      expect(
        parseNpmUrl(new URL("https://example.com/package/lodash")),
      ).toBeNull();
      expect(parseNpmUrl(new URL("https://github.com/aliou/repo"))).toBeNull();
    });

    it("rejects paths that are not package pages", () => {
      expect(parseNpmUrl(new URL("https://www.npmjs.com/"))).toBeNull();
      expect(
        parseNpmUrl(new URL("https://www.npmjs.com/settings/tokens")),
      ).toBeNull();
    });

    it("rejects scoped packages missing the name segment", () => {
      expect(
        parseNpmUrl(new URL("https://www.npmjs.com/package/@scope")),
      ).toBeNull();
    });
  });

  describe("buildNpmMarkdown", () => {
    const info = { packageName: "@golevelup/ts-vitest", version: "4.0.0" };
    const sourceUrl = "https://www.npmjs.com/package/@golevelup/ts-vitest";

    it("renders core metadata and README", () => {
      const meta: NpmMetadata = {
        name: "@golevelup/ts-vitest",
        version: "4.0.0",
        description: "Reusable utilities to help level up NestJS Testing",
        license: "MIT",
        author: "Jesse Carter <jesse.r.carter@gmail.com>",
        homepage: "https://github.com/golevelup/nestjs#readme",
        repository: {
          type: "git",
          url: "git+https://github.com/golevelup/nestjs.git",
        },
        keywords: ["NestJS", "vitest"],
        "dist-tags": { latest: "4.0.0" },
        dist: { unpackedSize: 26647, fileCount: 15 },
      };

      const markdown = buildNpmMarkdown(meta, "# Hello world", info, sourceUrl);

      expect(markdown).toContain("# @golevelup/ts-vitest");
      expect(markdown).toContain("- Version: 4.0.0");
      expect(markdown).toContain("- License: MIT");
      expect(markdown).toContain("- Author: Jesse Carter");
      expect(markdown).toContain(
        "- Repository: https://github.com/golevelup/nestjs",
      );
      expect(markdown).toContain("- Size: 26.0 KB (15 files)");
      expect(markdown).toContain("- Keywords: NestJS, vitest");
      expect(markdown).toContain("## README");
      expect(markdown).toContain("# Hello world");
      expect(markdown).toContain("## More via npm");
      expect(markdown).toContain("npm view @golevelup/ts-vitest@4.0.0");
    });

    it("notes latest dist-tag when viewing an older version", () => {
      const meta: NpmMetadata = {
        name: "lodash",
        version: "4.17.21",
        "dist-tags": { latest: "4.18.1" },
      };

      const markdown = buildNpmMarkdown(
        meta,
        "",
        { packageName: "lodash", version: "4.17.21" },
        "https://www.npmjs.com/package/lodash/v/4.17.21",
      );

      expect(markdown).toContain("- Version: 4.17.21 (latest: 4.18.1)");
    });

    it("falls back to description when README is missing", () => {
      const meta: NpmMetadata = {
        name: "tiny",
        version: "1.0.0",
        description: "A tiny package",
      };

      const markdown = buildNpmMarkdown(
        meta,
        "",
        { packageName: "tiny" },
        "https://www.npmjs.com/package/tiny",
      );

      expect(markdown).toContain("## Description");
      expect(markdown).toContain("A tiny package");
      expect(markdown).not.toContain("## README");
    });

    it("renders dependency sections", () => {
      const meta: NpmMetadata = {
        name: "pkg",
        version: "1.0.0",
        dependencies: { lodash: "^4.17.0" },
        peerDependencies: { vitest: "^1.0.0" },
      };

      const markdown = buildNpmMarkdown(
        meta,
        "",
        { packageName: "pkg" },
        "https://www.npmjs.com/package/pkg",
      );

      expect(markdown).toContain("## Dependencies (1)");
      expect(markdown).toContain("`lodash`: ^4.17.0");
      expect(markdown).toContain("## Peer Dependencies (1)");
      expect(markdown).toContain("`vitest`: ^1.0.0");
    });

    it("truncates dependency lists past the limit", () => {
      const deps: Record<string, string> = {};
      for (let i = 0; i < 40; i += 1) {
        deps[`dep-${i}`] = "^1.0.0";
      }

      const meta: NpmMetadata = {
        name: "pkg",
        version: "1.0.0",
        dependencies: deps,
      };

      const markdown = buildNpmMarkdown(
        meta,
        "",
        { packageName: "pkg" },
        "https://www.npmjs.com/package/pkg",
      );

      expect(markdown).toContain("## Dependencies (40)");
      expect(markdown).toContain("30 of 40 shown");
    });

    it("renders scripts and bin", () => {
      const meta: NpmMetadata = {
        name: "cli-pkg",
        version: "1.0.0",
        bin: { "cli-pkg": "bin/cli.js" },
        scripts: { build: "tsc", test: "vitest" },
      };

      const markdown = buildNpmMarkdown(
        meta,
        "",
        { packageName: "cli-pkg" },
        "https://www.npmjs.com/package/cli-pkg",
      );

      expect(markdown).toContain("- Bin: cli-pkg -> bin/cli.js");
      expect(markdown).toContain("## Scripts");
      expect(markdown).toContain("`build`: tsc");
      expect(markdown).toContain("`test`: vitest");
    });

    it("truncates very long READMEs for token safety", () => {
      const longReadme = "x".repeat(25_000);
      const meta: NpmMetadata = { name: "pkg", version: "1.0.0" };

      const markdown = buildNpmMarkdown(
        meta,
        longReadme,
        { packageName: "pkg" },
        "https://www.npmjs.com/package/pkg",
      );

      expect(markdown).toContain("[truncated for token safety]");
    });

    it("normalizes git+ repository URLs", () => {
      const meta: NpmMetadata = {
        name: "pkg",
        version: "1.0.0",
        repository: "git+ssh://git@github.com/aliou/repo.git",
      };

      const markdown = buildNpmMarkdown(
        meta,
        "",
        { packageName: "pkg" },
        "https://www.npmjs.com/package/pkg",
      );

      expect(markdown).toContain(
        "- Repository: ssh://git@github.com/aliou/repo",
      );
    });

    it("suggests the versions query when no version is pinned", () => {
      const meta: NpmMetadata = { name: "pkg", version: "1.0.0" };

      const markdown = buildNpmMarkdown(
        meta,
        "",
        { packageName: "pkg" },
        "https://www.npmjs.com/package/pkg",
      );

      expect(markdown).toContain("npm view pkg versions --json");
      expect(markdown).not.toContain("npm view pkg@1.0.0");
    });
  });
});
