import { rm } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createHerdrClientFromEnv,
  HERDR_CACHE_TOKEN,
  HERDR_METADATA_SOURCE,
  resolveSocketEndpoint,
} from "./client";

let server: Server | undefined;
let socketPath: string | undefined;
const originalEnvironment = {
  HERDR_ENV: process.env.HERDR_ENV,
  HERDR_PANE_ID: process.env.HERDR_PANE_ID,
  HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH,
};

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = undefined;
  }
  if (socketPath) {
    await rm(socketPath, { force: true });
    socketPath = undefined;
  }
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Herdr socket client", () => {
  it("reports prefixed metadata and notifications in order", async () => {
    socketPath = join(tmpdir(), `pi-harness-herdr-${process.pid}.sock`);
    await rm(socketPath, { force: true });
    const requests: Array<Record<string, unknown>> = [];
    server = createServer((socket) => {
      let input = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        input += chunk;
        const newline = input.indexOf("\n");
        if (newline === -1) return;
        requests.push(JSON.parse(input.slice(0, newline)));
        socket.end("{}\n");
      });
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(socketPath, resolve);
    });

    process.env.HERDR_ENV = "1";
    process.env.HERDR_SOCKET_PATH = socketPath;
    process.env.HERDR_PANE_ID = "test:p1";
    const client = createHerdrClientFromEnv();
    expect(client).toBeDefined();
    client?.reportMetadata({ [HERDR_CACHE_TOKEN]: "≡ 9m" }, 540_000);
    client?.showNotification({
      title: "Pi needs attention",
      body: "Approval required",
      sound: "request",
    });

    await waitFor(() => requests.length === 2);
    expect(requests.map((request) => request.method).sort()).toEqual([
      "notification.show",
      "pane.report_metadata",
    ]);
    const metadataRequest = requests.find(
      (request) => request.method === "pane.report_metadata",
    );
    expect(metadataRequest?.params).toMatchObject({
      pane_id: "test:p1",
      source: HERDR_METADATA_SOURCE,
      tokens: { [HERDR_CACHE_TOKEN]: "≡ 9m" },
      ttl_ms: 540_000,
    });
    const notificationRequest = requests.find(
      (request) => request.method === "notification.show",
    );
    expect(notificationRequest?.params).toEqual({
      title: "Pi needs attention",
      body: "Approval required",
      sound: "request",
    });
    client?.close();
  });

  it("uses Herdr's Windows named-pipe mapping", () => {
    expect(resolveSocketEndpoint("herdr.sock", "win32")).toBe(
      "\\\\.\\pipe\\herdr.sock",
    );
  });

  it("does not retry notifications whose response is lost", async () => {
    socketPath = join(
      tmpdir(),
      `pi-harness-herdr-notification-${process.pid}.sock`,
    );
    await rm(socketPath, { force: true });
    let attempts = 0;
    server = createServer((socket) => {
      socket.on("data", () => {
        attempts += 1;
      });
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(socketPath, resolve);
    });

    process.env.HERDR_ENV = "1";
    process.env.HERDR_SOCKET_PATH = socketPath;
    process.env.HERDR_PANE_ID = "test:p1";
    const client = createHerdrClientFromEnv();
    client?.showNotification({ title: "Attention", sound: "request" });

    await waitFor(() => attempts === 1);
    await new Promise((resolve) => setTimeout(resolve, 550));
    expect(attempts).toBe(1);
    client?.close();
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline && !predicate()) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(predicate()).toBe(true);
}
