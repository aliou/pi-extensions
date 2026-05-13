import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AD_NOTIFY_DANGEROUS_EVENT } from "@harness/events";

type EventMapper = (data: unknown) => Record<string, unknown> | undefined;

type EventBridge = {
  from: string;
  to: string;
  map: EventMapper;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function mapGuardrailsDangerous(
  data: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(data)) return undefined;

  const description =
    typeof data.description === "string"
      ? data.description
      : "dangerous command";

  const payload: Record<string, unknown> = {
    source: "defaults:event-compat:guardrails",
    description,
  };

  if (typeof data.command === "string") payload.command = data.command;
  if (typeof data.pattern === "string") payload.pattern = data.pattern;
  if (typeof data.toolName === "string") payload.toolName = data.toolName;
  if (typeof data.toolCallId === "string") payload.toolCallId = data.toolCallId;

  return payload;
}

function mapGuardrailsRiskDetected(
  data: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(data) || !isRecord(data.risk)) return undefined;

  const risk = data.risk;
  const action = isRecord(risk.action) ? risk.action : undefined;
  const metadata = isRecord(risk.metadata) ? risk.metadata : undefined;
  const description =
    typeof risk.reason === "string" ? risk.reason : "dangerous command";

  const payload: Record<string, unknown> = {
    source: "defaults:event-compat:guardrails",
    description,
  };

  if (typeof action?.command === "string") payload.command = action.command;
  if (typeof metadata?.pattern === "string") payload.pattern = metadata.pattern;
  if (typeof data.toolName === "string") payload.toolName = data.toolName;
  if (typeof data.toolCallId === "string") payload.toolCallId = data.toolCallId;

  return payload;
}

const BRIDGES: EventBridge[] = [
  {
    from: "guardrails:dangerous",
    to: AD_NOTIFY_DANGEROUS_EVENT,
    map: mapGuardrailsDangerous,
  },
  {
    from: "guardrails:risk:detected",
    to: AD_NOTIFY_DANGEROUS_EVENT,
    map: mapGuardrailsRiskDetected,
  },
];

/**
 * Bridge external extension events into harness-native events.
 *
 * Goal: keep one stable internal event API (`ad:*`) while allowing
 * backwards compatibility with older/public extension events.
 */
export default function (pi: ExtensionAPI): void {
  for (const bridge of BRIDGES) {
    pi.events.on(bridge.from, (data: unknown) => {
      const mapped = bridge.map(data);
      if (!mapped) return;
      pi.events.emit(bridge.to, mapped);
    });
  }
}
