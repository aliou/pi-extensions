export const WORKSPACE_METADATA_CUSTOM_TYPE = "workspace-metadata";

export interface WorkspaceRemote {
  name: string;
  host: string;
  repo: string;
}

export interface WorkspaceMetadata {
  hostname: string;
  cwd: string;
  remotes: WorkspaceRemote[];
}
