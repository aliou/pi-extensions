import type { ProviderId, ProviderUsageClient } from "./types";

export class ProviderUsageRegistry {
  readonly clients: readonly ProviderUsageClient[];

  constructor(clients: readonly ProviderUsageClient[]) {
    this.clients = clients;
  }

  get(provider: ProviderId): ProviderUsageClient | undefined {
    return this.clients.find((client) => client.id === provider);
  }

  require(provider: ProviderId): ProviderUsageClient {
    const client = this.get(provider);
    if (!client)
      throw new Error(`No provider usage client registered for ${provider}`);
    return client;
  }
}
