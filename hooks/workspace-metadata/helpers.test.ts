import type { AssistantMessage, UserMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  parseGitRemotes,
  parseRemoteUrl,
  shouldCaptureWorkspaceMetadata,
} from "./helpers";

function messageEntry(message: UserMessage | AssistantMessage): SessionEntry {
  return {
    type: "message",
    id: "entry-id",
    parentId: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    message,
  };
}

const userEntry = messageEntry({
  role: "user",
  content: "hello",
  timestamp: 0,
});

const assistantEntry = messageEntry({
  role: "assistant",
  content: [{ type: "text", text: "hello" }],
  api: "anthropic-messages",
  provider: "anthropic",
  model: "test",
  usage: {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  },
  stopReason: "stop",
  timestamp: 0,
});

describe("parseRemoteUrl", () => {
  it.each([
    {
      url: "git@github.com:aliou/pi-harness.git",
      expected: { host: "github.com", repo: "aliou/pi-harness" },
    },
    {
      url: "https://user:token@code.378labs.dev/org/project.git",
      expected: { host: "code.378labs.dev", repo: "org/project" },
    },
    {
      url: "ssh://git@github.com/aliou/pi-harness.git",
      expected: { host: "github.com", repo: "aliou/pi-harness" },
    },
    {
      url: "git@tangled.org:did:plc:h6vbj4hos733yigefqbjva5k",
      expected: {
        host: "tangled.org",
        repo: "did:plc:h6vbj4hos733yigefqbjva5k",
      },
    },
  ])("parses $url", ({ url, expected }) => {
    expect(parseRemoteUrl(url)).toEqual(expected);
  });

  it.each([
    "",
    "/local/repository",
    "C:/Users/example/repository",
    "file:///local/repository",
  ])("ignores hostless remote %s", (url) => {
    expect(parseRemoteUrl(url)).toBeNull();
  });
});

describe("parseGitRemotes", () => {
  it("keeps one fetch URL per remote", () => {
    const stdout = [
      "origin\tgit@github.com:aliou/pi-harness.git (fetch)",
      "origin\tgit@github.com:aliou/pi-harness.git (push)",
      "tangled\tgit@tangled.org:did:plc:h6vbj4hos733yigefqbjva5k (fetch)",
      "tangled\tgit@tangled.org:did:plc:h6vbj4hos733yigefqbjva5k (push)",
    ].join("\n");

    expect(parseGitRemotes(stdout)).toEqual([
      { name: "origin", host: "github.com", repo: "aliou/pi-harness" },
      {
        name: "tangled",
        host: "tangled.org",
        repo: "did:plc:h6vbj4hos733yigefqbjva5k",
      },
    ]);
  });
});

describe("shouldCaptureWorkspaceMetadata", () => {
  const metadataEntry: SessionEntry = {
    type: "custom",
    id: "workspace-metadata",
    parentId: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    customType: "workspace-metadata",
    data: {},
  };

  it.each([
    { reason: "startup" as const, entries: [], expected: true },
    { reason: "startup" as const, entries: [userEntry], expected: true },
    {
      reason: "startup" as const,
      entries: [assistantEntry],
      expected: true,
    },
    { reason: "new" as const, entries: [assistantEntry], expected: true },
    { reason: "fork" as const, entries: [assistantEntry], expected: true },
    { reason: "resume" as const, entries: [], expected: true },
    { reason: "reload" as const, entries: [], expected: true },
    {
      reason: "startup" as const,
      entries: [metadataEntry],
      expected: false,
    },
    {
      reason: "resume" as const,
      entries: [metadataEntry],
      expected: false,
    },
    {
      reason: "reload" as const,
      entries: [metadataEntry],
      expected: false,
    },
    {
      reason: "new" as const,
      entries: [metadataEntry],
      expected: true,
    },
    {
      reason: "fork" as const,
      entries: [metadataEntry],
      expected: true,
    },
  ])("returns $expected for $reason", ({ reason, entries, expected }) => {
    expect(shouldCaptureWorkspaceMetadata(reason, entries)).toBe(expected);
  });
});
