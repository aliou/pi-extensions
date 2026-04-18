/**
 * Configuration for the project extension.
 */

import { ConfigLoader } from "@aliou/pi-utils-settings";

export interface ProjectConfig {
  registry?: string;
  scope?: string;
  childProjectDepth?: number;
}

export interface ResolvedProjectConfig {
  registry: string;
  scope: string;
  childProjectDepth: number;
}

const DEFAULT_CONFIG: ResolvedProjectConfig = {
  registry: "",
  scope: "",
  childProjectDepth: 2,
};

export const configLoader = new ConfigLoader<
  ProjectConfig,
  ResolvedProjectConfig
>("projects", DEFAULT_CONFIG, {
  scopes: ["global"],
});
