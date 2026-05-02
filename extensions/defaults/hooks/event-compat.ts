import { AD_NOTIFY_DANGEROUS_EVENT } from "@harness/events";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type EventMapper = (data: unknown) => Record<string, unknown> | undefined;

type EventBridge = {
  from: string;
  to: string;
  map: EventMapper;
};

function mapGuardrailsDangerous(
  data: unknown,
): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return undefined;

  const raw = data as Record<string, unknown>;
  const description =
    typeof raw.description === "string" ? raw.description : "dangerous command";

  const payload: Record<string, unknown> = {
    source: "defaults:event-compat:guardrails",
    description,
  };

  if (typeof raw.command === "string") payload.command = raw.command;
  if (typeof raw.pattern === "string") payload.pattern = raw.pattern;
  if (typeof raw.toolName === "string") payload.toolName = raw.toolName;
  if (typeof raw.toolCallId === "string") payload.toolCallId = raw.toolCallId;

  return payload;
}

const BRIDGES: EventBridge[] = [
  {
    from: "guardrails:dangerous",
    to: AD_NOTIFY_DANGEROUS_EVENT,
    map: mapGuardrailsDangerous,
  },
];

/**
 * Bridge external extension events into harness-native events.
 *
 * Goal: keep one stable internal event API (`ad:*`) while allowing
 * backwards compatibility with older/public extension events.
 */
export function setupEventCompatHook(pi: ExtensionAPI): void {
  for (const bridge of BRIDGES) {
    pi.events.on(bridge.from, (data: unknown) => {
      const mapped = bridge.map(data);
      if (!mapped) return;
      pi.events.emit(bridge.to, mapped);
    });
  }
}
