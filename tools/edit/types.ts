export type NvimUndoPathResolver = (args: {
  toolName: string;
  toolCallId: string;
  input: Record<string, unknown>;
  cwd: string;
}) => string | string[] | undefined | Promise<string | string[] | undefined>;
