import type {
  ExtensionAPI,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const toolParams = Type.Object({
  title: Type.String({ description: "The title of the session" }),
  tags: Type.Array(Type.String({ description: "a tag" }), {
    description: "a list of tag",
  }),
  repository: Type.Optional(Type.String({ description: "org/repo" })),
});

const setSessionMetadata: ToolDefinition<typeof toolParams> = {
  name: "set_session_metadata",
  label: "Set session metadata",
  description:
    "Sets session title, tags and repository of inside of a repository.",
  parameters: toolParams,
  execute: (_toolCallId, newMetadata, _onUpdate, ctx, _signal) => {
    const latestEntry = ctx.sessionManager
      .getEntries()
      .filter(
        (entry) =>
          entry.type === "custom" && entry.customType === "ad-history:metadata",
      )
      .at(-1);

    const metadataEntry = {
      ...latestEntry,
      newMetadata,
    };

    // TODO: add new custom entry.
    // TODO: replace line in index.

    throw new Error("Function not implemented.");
  },
};

// TODO:
//   - set_session_metadata (title, tags, repo)
//   - find_session by title, by tag, by repo, fuzzy with bm25
//   - read_session read session by id.
export const setupTools = (pi: ExtensionAPI) => {
  pi.registerTool(setSessionMetadata);
};
