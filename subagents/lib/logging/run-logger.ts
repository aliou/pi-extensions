import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateRunId, getLogDirectory } from "@subagents/lib/logging/paths";
import {
  getToolResultDetails,
  type SubagentToolCall,
} from "@subagents/lib/types";

export interface RunLogger {
  /** Unique run identifier */
  runId: string;
  /** Path to human-readable stream log */
  streamPath: string;
  /** Path to JSONL debug log */
  debugPath: string;

  /** Log a text delta to stream log */
  logTextDelta(delta: string, accumulated: string): Promise<void>;

  /** Log tool execution start */
  logToolStart(call: SubagentToolCall): Promise<void>;

  /** Log tool execution end */
  logToolEnd(call: SubagentToolCall): Promise<void>;

  /** Log raw event to debug log (JSONL) */
  logEventRaw(event: unknown): Promise<void>;

  /** Flush and close log files */
  close(): Promise<void>;
}

function formatTimestamp(): string {
  const now = new Date();
  return (
    now.toTimeString().split(" ")[0] +
    "." +
    String(now.getMilliseconds()).padStart(3, "0")
  );
}

class RunLoggerImpl implements RunLogger {
  public readonly runId: string;
  public readonly streamPath: string;
  public readonly debugPath: string;

  private streamHandle: fs.FileHandle | null = null;
  private debugHandle: fs.FileHandle | null = null;
  private enableDebug: boolean;
  private lastTextLength = 0;

  constructor(runId: string, logDir: string, enableDebug: boolean) {
    this.runId = runId;
    this.streamPath = path.join(logDir, "stream.log");
    this.debugPath = path.join(logDir, "debug.jsonl");
    this.enableDebug = enableDebug;
  }

  async init(): Promise<void> {
    const dir = path.dirname(this.streamPath);
    await fs.mkdir(dir, { recursive: true });
    this.streamHandle = await fs.open(this.streamPath, "a");
    if (this.enableDebug) {
      this.debugHandle = await fs.open(this.debugPath, "a");
    }
    await this.writeStream(`[${formatTimestamp()}] Starting subagent\n`);
  }

  async logTextDelta(_delta: string, accumulated: string): Promise<void> {
    // Only log final response on first meaningful content
    if (this.lastTextLength === 0 && accumulated.trim().length > 0) {
      await this.writeStream(`[${formatTimestamp()}] Response:\n`);
    }
    this.lastTextLength = accumulated.length;
  }

  async logToolStart(call: SubagentToolCall): Promise<void> {
    const argsStr =
      Object.keys(call.args).length > 0
        ? ` ${JSON.stringify(call.args).slice(0, 100)}`
        : "";
    await this.writeStream(
      `[${formatTimestamp()}] Tool: ${call.toolName}${argsStr}\n`,
    );
  }

  async logToolEnd(call: SubagentToolCall): Promise<void> {
    const status = call.status === "error" ? "error" : "completed";
    const errorSuffix = call.error ? ` - ${call.error.slice(0, 100)}` : "";

    const details = getToolResultDetails(call.result);
    const provider =
      typeof details?.provider === "string" ? details.provider : undefined;
    const cost = typeof details?.cost === "number" ? details.cost : undefined;
    const currency =
      details?.costCurrency === "EUR" || details?.costCurrency === "USD"
        ? details.costCurrency
        : undefined;

    const telemetryParts: string[] = [];
    if (provider) telemetryParts.push(`provider=${provider}`);
    if (call.durationMs !== undefined)
      telemetryParts.push(`duration=${call.durationMs}ms`);
    if (cost !== undefined) {
      if (currency === "EUR") {
        telemetryParts.push(`cost=€${cost}`);
      } else {
        telemetryParts.push(`cost=$${cost}`);
      }
    }

    const telemetrySuffix =
      telemetryParts.length > 0 ? ` (${telemetryParts.join(" ")})` : "";

    await this.writeStream(
      `[${formatTimestamp()}] Tool: ${call.toolName} ${status}${telemetrySuffix}${errorSuffix}\n`,
    );
  }

  async logEventRaw(event: unknown): Promise<void> {
    if (this.debugHandle) {
      const line = `${JSON.stringify(event)}\n`;
      await this.debugHandle.write(line);
    }
  }

  async close(): Promise<void> {
    await this.writeStream(`[${formatTimestamp()}] Subagent finished\n`);
    try {
      await this.streamHandle?.close();
    } catch {
      /* best effort */
    }
    try {
      await this.debugHandle?.close();
    } catch {
      /* best effort */
    }
    this.streamHandle = null;
    this.debugHandle = null;
  }

  private async writeStream(content: string): Promise<void> {
    if (this.streamHandle) {
      await this.streamHandle.write(content);
    }
  }
}

/**
 * Create a run logger for a subagent execution.
 *
 * @param cwd - Current working directory
 * @param subagentName - Name of the subagent
 * @param enableDebug - Whether to write debug.jsonl
 */
export async function createRunLogger(
  cwd: string,
  subagentName: string,
  enableDebug: boolean,
): Promise<RunLogger> {
  const runId = generateRunId(subagentName);
  const logDir = getLogDirectory(cwd, subagentName, runId);
  const logger = new RunLoggerImpl(runId, logDir, enableDebug);
  await logger.init();
  return logger;
}
