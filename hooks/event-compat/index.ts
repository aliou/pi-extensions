import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_NOTIFY_ATTENTION_EVENT,
  AD_NOTIFY_DANGEROUS_EVENT,
} from "@harness/events";

type EventMapper = (data: unknown) => Record<string, unknown> | undefined;

type EventBridge = {
  from: string;
  to: string;
  map: EventMapper;
};

type GuardrailsAction = {
  command?: string;
};

type GuardrailsRiskMetadata = {
  pattern?: string;
};

type GuardrailsRiskDetectedPayload = {
  risk: {
    reason?: string;
    action?: GuardrailsAction;
    metadata?: GuardrailsRiskMetadata;
  };
  toolName?: string;
  toolCallId?: string;
};

type GuardrailsActionPromptedPayload = {
  feature: "pathAccess" | string;
  prompt?: {
    kind?: string;
  };
  context?: {
    toolName?: string;
  };
  reason?: string;
};

function mapGuardrailsRiskDetected(
  event: GuardrailsRiskDetectedPayload,
): Record<string, unknown> | undefined {
  const risk = event.risk;
  const description = risk.reason ?? "dangerous command";

  const payload: Record<string, unknown> = {
    source: "defaults:event-compat:guardrails",
    description,
  };

  if (risk.action?.command) payload.command = risk.action.command;
  if (risk.metadata?.pattern) payload.pattern = risk.metadata.pattern;
  if (event.toolName) payload.toolName = event.toolName;
  if (event.toolCallId) payload.toolCallId = event.toolCallId;

  return payload;
}

function mapGuardrailsActionPrompted(
  event: GuardrailsActionPromptedPayload,
): Record<string, unknown> | undefined {
  if (event.feature !== "pathAccess") return undefined;
  if (event.prompt?.kind !== "confirmation") return undefined;

  const description = event.reason ?? "Path access requires confirmation";

  const payload: Record<string, unknown> = {
    source: "defaults:event-compat:guardrails",
    description,
  };

  if (event.context?.toolName) {
    payload.toolName = event.context.toolName;
  }

  return payload;
}

const BRIDGES: EventBridge[] = [
  {
    from: "guardrails:risk:detected",
    to: AD_NOTIFY_DANGEROUS_EVENT,
    map: (data) =>
      mapGuardrailsRiskDetected(data as GuardrailsRiskDetectedPayload),
  },
  {
    from: "guardrails:action:prompted",
    to: AD_NOTIFY_ATTENTION_EVENT,
    map: (data) =>
      mapGuardrailsActionPrompted(data as GuardrailsActionPromptedPayload),
  },
];

function registerBridge(pi: ExtensionAPI, bridge: EventBridge): void {
  pi.events.on(bridge.from, (data: unknown) => {
    const mapped = bridge.map(data);
    if (!mapped) return;
    pi.events.emit(bridge.to, mapped);
  });
}

/**
 * Bridge external extension events into harness-native events.
 *
 * Goal: keep one stable internal event API (`ad:*`) while allowing
 * backwards compatibility with older/public extension events.
 */
export default function (pi: ExtensionAPI): void {
  for (const bridge of BRIDGES) {
    registerBridge(pi, bridge);
  }
}
