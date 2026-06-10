import { AuthStorage } from "@earendil-works/pi-coding-agent";
import type { ProviderId, ProviderUsageFetchContext } from "./types";

export async function getProviderApiKey(
  provider: ProviderId,
  ctx?: ProviderUsageFetchContext,
): Promise<string> {
  const authStorage = ctx?.authStorage ?? AuthStorage.create();
  const key = await authStorage.getApiKey(provider);
  if (!key) throw new Error(`No credentials for ${provider}`);
  return key;
}
