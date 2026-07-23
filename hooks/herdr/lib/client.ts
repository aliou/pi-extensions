import net, { type Socket } from "node:net";

export const HERDR_METADATA_SOURCE = "ad:pi-harness";
export const HERDR_CACHE_TOKEN = "ad_cache";

export type HerdrNotification = {
  title: string;
  body?: string;
  sound: "none" | "done" | "request";
};

export interface HerdrClient {
  reportMetadata(tokens: Record<string, string | null>, ttlMs?: number): void;
  showNotification(notification: HerdrNotification): void;
  close(): void;
}

type JsonRpcRequest = {
  id: string;
  method: string;
  params: Record<string, unknown>;
};

let reportSequence = Date.now() * 1000;

function nextReportSequence(): number {
  reportSequence = Math.max(reportSequence + 1, Date.now() * 1000);
  return reportSequence;
}

export function resolveSocketEndpoint(
  socketPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath;
}

class SocketHerdrClient implements HerdrClient {
  private readonly queue: JsonRpcRequest[] = [];
  private readonly activeSockets = new Set<Socket>();
  private draining = false;
  private closed = false;

  constructor(
    private readonly endpoint: string,
    private readonly paneId: string,
  ) {}

  reportMetadata(tokens: Record<string, string | null>, ttlMs?: number): void {
    const validTtlMs =
      Number.isInteger(ttlMs) &&
      ttlMs !== undefined &&
      ttlMs >= 1 &&
      ttlMs <= 86_400_000
        ? ttlMs
        : undefined;
    this.enqueue({
      id: this.requestId("metadata"),
      method: "pane.report_metadata",
      params: {
        pane_id: this.paneId,
        source: HERDR_METADATA_SOURCE,
        tokens,
        seq: nextReportSequence(),
        ttl_ms: validTtlMs,
      },
    });
  }

  showNotification(notification: HerdrNotification): void {
    if (this.closed) return;
    void this.sendAttempt(
      {
        id: this.requestId("notification"),
        method: "notification.show",
        params: notification,
      },
      500,
    );
  }

  close(): void {
    this.closed = true;
    this.queue.length = 0;
    for (const socket of this.activeSockets) socket.destroy();
    this.activeSockets.clear();
  }

  private requestId(kind: string): string {
    return `${HERDR_METADATA_SOURCE}:${kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }

  private enqueue(request: JsonRpcRequest): void {
    if (this.closed) return;
    this.queue.push(request);
    if (!this.draining) void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining || this.closed) return;
    this.draining = true;
    try {
      while (!this.closed && this.queue.length > 0) {
        const request = this.queue.shift();
        if (request) await this.sendRequest(request);
      }
    } finally {
      this.draining = false;
      if (!this.closed && this.queue.length > 0) void this.drain();
    }
  }

  private async sendRequest(request: JsonRpcRequest): Promise<void> {
    if (await this.sendAttempt(request, 500)) return;
    if (!this.closed) await this.sendAttempt(request, 1500);
  }

  private sendAttempt(
    request: JsonRpcRequest,
    timeoutMs: number,
  ): Promise<boolean> {
    if (this.closed) return Promise.resolve(false);

    return new Promise((resolve) => {
      let done = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const socket = net.createConnection(this.endpoint);
      this.activeSockets.add(socket);

      const finish = (delivered: boolean) => {
        if (done) return;
        done = true;
        if (timeout) clearTimeout(timeout);
        this.activeSockets.delete(socket);
        socket.destroy();
        resolve(delivered);
      };

      socket.on("error", () => finish(false));
      socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
      socket.on("data", () => finish(true));
      socket.on("end", () => finish(false));
      socket.on("close", () => finish(false));
      timeout = setTimeout(() => finish(false), timeoutMs);
      timeout.unref?.();
    });
  }
}

export function createHerdrClientFromEnv(): HerdrClient | undefined {
  const socketPath = process.env.HERDR_SOCKET_PATH;
  const paneId = process.env.HERDR_PANE_ID;
  if (process.env.HERDR_ENV !== "1" || !socketPath || !paneId) return undefined;

  return new SocketHerdrClient(resolveSocketEndpoint(socketPath), paneId);
}
