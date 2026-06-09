/** Config schema for trust-paths.json. */
export interface TrustPathsConfig {
  /** Directory path prefixes to auto-trust. Supports `~` expansion. */
  trustedPaths?: string[];
}
