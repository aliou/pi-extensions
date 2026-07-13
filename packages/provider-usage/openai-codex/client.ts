import {
  fetchJson,
  getProviderApiKey,
  type ProviderUsageClient,
} from "../core/index";
import { parseOpenAiCodexResponseHeaders } from "./headers";
import { normalizeOpenAiCodexUsage } from "./normalize";
import type {
  OpenAiCodexResetCreditsResponse,
  OpenAiCodexUsageResponse,
} from "./raw-types";

const USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
const RESET_CREDITS_ENDPOINT =
  "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";

export const openAiCodexUsageClient: ProviderUsageClient = {
  id: "openai-codex",
  displayName: "OpenAI Codex",
  capabilities: {
    api: true,
    oauth: true,
    apiKey: false,
    responseHeaders: true,
    status: true,
  },
  async fetchUsage(ctx) {
    const token = await getProviderApiKey("openai-codex", ctx);
    const accountId = chatGptAccountId(token);
    const fetchedAt = ctx?.now ?? new Date();
    const [raw, resetCredits] = await Promise.all([
      fetchJson<OpenAiCodexUsageResponse>(USAGE_ENDPOINT, ctx, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "ChatGPT-Account-Id": accountId,
          originator: "pi",
          "User-Agent": "pi-harness-provider-usage",
        },
      }),
      fetchJson<OpenAiCodexResetCreditsResponse>(RESET_CREDITS_ENDPOINT, ctx, {
        signal: resetCreditsSignal(ctx?.signal),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "ChatGPT-Account-ID": accountId,
          "OpenAI-Beta": "codex-1",
          originator: "Codex Desktop",
          "User-Agent": "pi-harness-provider-usage",
        },
      }).catch(() => undefined),
    ]);
    return normalizeOpenAiCodexUsage(
      raw,
      fetchedAt,
      USAGE_ENDPOINT,
      resetCredits,
    );
  },
  parseResponseHeaders(headers, ctx) {
    return parseOpenAiCodexResponseHeaders(headers, ctx?.now);
  },
};

function resetCreditsSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(4_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function chatGptAccountId(token: string): string {
  const [, encoded] = token.split(".");
  if (!encoded) throw new Error("OpenAI Codex token is not a JWT");
  const payload = JSON.parse(
    Buffer.from(padBase64Url(encoded), "base64").toString("utf-8"),
  );
  const accountId =
    payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;
  if (!accountId || typeof accountId !== "string")
    throw new Error("No ChatGPT account ID in OpenAI Codex token");
  return accountId;
}

function padBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
}
