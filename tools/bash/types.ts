import type { BashSpawnContext } from "@earendil-works/pi-coding-agent";

export type SpawnHookContributor = {
  id: string;
  priority?: number;
  spawnHook: (ctx: BashSpawnContext) => BashSpawnContext;
};

export type SpawnHookRequestPayload = {
  register: (contributor: SpawnHookContributor) => void;
};

export const AD_BASH_SPAWN_HOOK_REQUEST_EVENT = "ad:bash:spawn-hook:request";
