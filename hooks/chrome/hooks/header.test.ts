import { homedir } from "node:os";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { WORKSPACE_METADATA_CUSTOM_TYPE } from "@harness/events";
import { describe, expect, it } from "vitest";
import { formatWorkspaceMetadata } from "../components/header";
import { findLatestWorkspaceMetadata } from "./header";

describe("header workspace metadata", () => {
  it("shows the origin remote when present", () => {
    expect(
      formatWorkspaceMetadata({
        hostname: "cleo",
        cwd: `${homedir()}/project`,
        remotes: [
          { name: "upstream", host: "github.com", repo: "earendil-works/pi" },
          { name: "origin", host: "github.com", repo: "aliou/pi-harness" },
        ],
      }),
    ).toBe("[cleo] github:aliou/pi-harness");
  });

  it("falls back to the first remote when origin is missing", () => {
    expect(
      formatWorkspaceMetadata({
        hostname: "cleo",
        cwd: `${homedir()}/project`,
        remotes: [
          { name: "upstream", host: "gitlab.com", repo: "aliou/pi-harness" },
        ],
      }),
    ).toBe("[cleo] gitlab.com:aliou/pi-harness");
  });

  it("falls back to compact cwd when no remotes are present", () => {
    expect(
      formatWorkspaceMetadata({
        hostname: "cleo",
        cwd: `${homedir()}/project`,
        remotes: [],
      }),
    ).toBe("[cleo] ~/project");
  });

  it("uses the latest valid workspace metadata entry from the session", () => {
    const entries = [
      {
        type: "custom",
        customType: WORKSPACE_METADATA_CUSTOM_TYPE,
        data: { hostname: "old", cwd: "/old", remotes: [] },
      },
      {
        type: "custom",
        customType: WORKSPACE_METADATA_CUSTOM_TYPE,
        data: { hostname: "new", cwd: "/new", remotes: [] },
      },
    ] as SessionEntry[];

    expect(findLatestWorkspaceMetadata(entries)).toEqual({
      hostname: "new",
      cwd: "/new",
      remotes: [],
    });
  });
});
