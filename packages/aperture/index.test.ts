import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ agentDir: "" }));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => mocks.agentDir,
}));

const {
  getApertureBaseUrl,
  getApertureConfigPath,
  readApertureConfig,
  setApertureBaseUrl,
} = await import("./index");

describe("aperture config", () => {
  beforeEach(async () => {
    mocks.agentDir = await mkdtemp(join(tmpdir(), "harness-aperture-"));
  });

  afterEach(async () => {
    await rm(mocks.agentDir, { recursive: true, force: true });
  });

  it("uses the global aperture config path", () => {
    expect(getApertureConfigPath()).toBe(
      join(mocks.agentDir, "extensions", "aperture.json"),
    );
  });

  it("returns no config when the file is missing", () => {
    expect(readApertureConfig()).toEqual({});
    expect(getApertureBaseUrl()).toBeUndefined();
  });

  it.each([
    "not json",
    "null",
    "[]",
    '"value"',
    "42",
  ])("ignores invalid config: %s", async (contents) => {
    await writeRawConfig(contents);

    expect(readApertureConfig()).toEqual({});
    expect(getApertureBaseUrl()).toBeUndefined();
  });

  it("reads baseUrl and retains the complete schema", async () => {
    const config = {
      $schema: "https://example.test/aperture.schema.json",
      baseUrl: "http://gateway.test///",
      proxy: { enabled: true },
      dedicated: { enabled: false },
      connectors: { enabled: true },
    };
    await writeRawConfig(`${JSON.stringify(config)}\n`);

    expect(readApertureConfig()).toEqual(config);
    expect(getApertureBaseUrl()).toBe("http://gateway.test");
  });

  it("ignores the former apertureBaseUrl key", async () => {
    await writeRawConfig(
      JSON.stringify({ apertureBaseUrl: "http://legacy.test" }),
    );

    expect(getApertureBaseUrl()).toBeUndefined();
  });

  it("creates aperture.json when setting the URL", async () => {
    await setApertureBaseUrl("http://gateway.test///");
    const config = await readJsonConfig();

    expect(existsSync(getApertureConfigPath())).toBe(true);
    expect(config).toEqual({
      baseUrl: "http://gateway.test",
    });
  });

  it("updates only baseUrl in an existing config", async () => {
    const existing = {
      $schema: "https://example.test/aperture.schema.json",
      baseUrl: "http://old.test",
      onboardingDone: true,
      proxy: { enabled: true, upstreamProviders: [{ id: "anthropic" }] },
      dedicated: { enabled: true, providers: [] },
      connectors: { enabled: false, discoveryTools: true },
    };
    await writeRawConfig(JSON.stringify(existing));

    await setApertureBaseUrl("http://new.test/");
    const config = await readJsonConfig();

    expect(config).toEqual({
      ...existing,
      baseUrl: "http://new.test",
    });
  });
});

async function writeRawConfig(contents: string): Promise<void> {
  const path = getApertureConfigPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf-8");
}

async function readJsonConfig(): Promise<unknown> {
  const contents = await readFile(getApertureConfigPath(), "utf-8");
  return JSON.parse(contents);
}
