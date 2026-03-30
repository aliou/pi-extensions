import { ExaProvider } from "@subagents/scout/providers/exa";
import { LinkupProvider } from "@subagents/scout/providers/linkup";
import { MarkdownNewProvider } from "@subagents/scout/providers/markdown-dot-new";
import { SyntheticProvider } from "@subagents/scout/providers/synthetic";
import type {
  ScoutProviderBase,
  ScoutProviderId,
} from "@subagents/scout/providers/types";

export function createScoutProviders(): ScoutProviderBase[] {
  return [
    new ExaProvider(),
    new LinkupProvider(),
    new MarkdownNewProvider(),
    new SyntheticProvider(),
  ];
}

export function getProviderById(
  id: ScoutProviderId,
): ScoutProviderBase | undefined {
  return createScoutProviders().find((provider) => provider.id === id);
}
