import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { ProviderId, ProviderUsageFetchContext } from "./types";

export async function getProviderApiKey(
  provider: ProviderId,
  ctx?: ProviderUsageFetchContext,
): Promise<string> {
  let key: string | undefined;
  if (ctx?.getProviderApiKey) {
    key = await ctx.getProviderApiKey(provider);
  } else {
    const runtime = await ModelRuntime.create();
    const auth = await runtime.getAuth(provider);
    key = auth?.auth.apiKey;
  }
  if (!key) throw new Error(`No credentials for ${provider}`);
  return key;
}
