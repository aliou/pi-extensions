import type { AssistantMessage, StopReason } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import {
  type AttemptFailure,
  type AttemptPhase,
  classifyAttempt,
  isSubagentAttemptError,
  SubagentAttemptError,
} from "./attempt";

function assistant(
  overrides: Partial<AssistantMessage> & { stopReason?: StopReason } = {},
): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: "openai-completions",
    provider: "neuralwatt",
    model: "gemma-4-31b",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    timestamp: 0,
    ...overrides,
  };
}

function failure(overrides: Partial<AttemptFailure> = {}): AttemptFailure {
  return {
    phase: "prompt",
    started: false,
    aborted: false,
    cause: new Error("boom"),
    provider: "neuralwatt",
    model: "gemma-4-31b",
    message: "boom",
    ...overrides,
  };
}

function providerError(text: string): AttemptFailure {
  return failure({ assistant: assistant({ errorMessage: text }) });
}

describe("classifyAttempt", () => {
  it("never retries an aborted attempt", () => {
    expect(classifyAttempt(failure({ aborted: true }))).toEqual({
      action: "fatal",
      cooldown: "none",
      reason: "aborted",
    });
    expect(
      classifyAttempt(
        failure({ assistant: assistant({ stopReason: "aborted" }) }),
      ).action,
    ).toBe("fatal");
  });

  it("never retries once output has streamed", () => {
    const classification = classifyAttempt(
      providerError("500: upstream died mid-stream"),
    );
    expect(classification.action).toBe("next-entry");

    const afterStart = classifyAttempt({
      ...providerError("500: upstream died mid-stream"),
      started: true,
    });
    expect(afterStart).toEqual({
      action: "fatal",
      cooldown: "none",
      reason: "failed-after-start",
    });
  });

  it("fails over on a startup stall and cools the provider", () => {
    expect(classifyAttempt(failure({ phase: "startup-timeout" }))).toEqual({
      action: "next-entry",
      cooldown: "provider",
      reason: "no output",
    });
  });

  it("never retries our own setup phases", () => {
    const phases: AttemptPhase[] = ["setup", "build-prompt", "before-execute"];
    for (const phase of phases) {
      expect(classifyAttempt(failure({ phase })).action).toBe("fatal");
    }
  });

  it("never retries a pre-start throw with no provider response", () => {
    expect(classifyAttempt(failure({ assistant: undefined }))).toEqual({
      action: "fatal",
      cooldown: "none",
      reason: "no provider response",
    });
  });

  it("never retries context overflow", () => {
    expect(
      classifyAttempt(
        providerError("Your input exceeds the context window of this model."),
      ),
    ).toEqual({
      action: "fatal",
      cooldown: "none",
      reason: "context overflow",
    });
  });

  it("never retries a clean but empty completion", () => {
    expect(
      classifyAttempt(
        failure({ assistant: assistant({ stopReason: "stop" }) }),
      ),
    ).toEqual({ action: "fatal", cooldown: "none", reason: "blank response" });
  });

  it("fails over and cools the provider on quota exhaustion", () => {
    for (const text of [
      '402: {"error":"payment required"}',
      '429: {"error":{"code":"insufficient_quota"}}',
      "Monthly usage limit reached",
      "400: out of budget",
    ]) {
      expect(classifyAttempt(providerError(text))).toEqual({
        action: "next-entry",
        cooldown: "provider",
        reason: "quota",
      });
    }
  });

  it("fails over and cools the provider on transient and transport errors", () => {
    for (const text of [
      "503: service unavailable",
      "500: internal error",
      "Overloaded",
      "socket hang up",
      "fetch failed",
      "getaddrinfo EAI_AGAIN gateway.internal",
    ]) {
      expect(classifyAttempt(providerError(text))).toEqual({
        action: "next-entry",
        cooldown: "provider",
        reason: "transient",
      });
    }
  });

  it("fails over without a cooldown on deterministic model rejections", () => {
    for (const text of [
      '404: {"error":"model not found"}',
      "content policy violation",
      // pi's transient matcher does not recognize bare errno codes, so these
      // land here: still a failover, just without cooling the provider.
      "connect ECONNREFUSED 100.64.0.1:8080",
    ]) {
      expect(classifyAttempt(providerError(text))).toEqual({
        action: "next-entry",
        cooldown: "none",
        reason: "provider error",
      });
    }
  });
});

describe("SubagentAttemptError", () => {
  it("names the model that failed and carries the raw failure", () => {
    const error = new SubagentAttemptError(failure({ message: "no answer" }));
    expect(error.message).toBe("neuralwatt/gemma-4-31b: no answer");
    expect(isSubagentAttemptError(error)).toBe(true);
    expect(isSubagentAttemptError(new Error("no answer"))).toBe(false);
    expect(error.failure).toMatchObject({
      provider: "neuralwatt",
      model: "gemma-4-31b",
      message: "no answer",
    });
  });
});
