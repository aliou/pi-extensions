import {
  compactEntry,
  entryRole,
  entrySearchText,
  fullEntryContent,
  truncate,
} from "./content";
import { flattenTree } from "./session-view";
import type { SessionEntry, SessionTreeNode, SessionView } from "./types";

const DEFAULT_BRANCH_LIMIT = 100;
const DEFAULT_TREE_LIMIT = 200;
const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_CHECKPOINT_LIMIT = 100;
const DEFAULT_SESSION_MAP_BRANCH_LIMIT = 12;
const DEFAULT_SESSION_MAP_CHECKPOINT_LIMIT = 20;
const DEFAULT_SESSION_MAP_RECENT_LIMIT = 3;
const MAX_LIMIT = 500;
const SUMMARY_PREVIEW_LIMIT = 800;
const DEFAULT_ENTRY_MAX_CHARS = 20_000;
const MAX_ENTRY_MAX_CHARS = 100_000;

const boundedLimit = (
  limit: number | undefined,
  defaultLimit: number,
): number => Math.min(Math.max(1, limit ?? defaultLimit), MAX_LIMIT);

const snippetFor = (text: string, query: string): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  const idx = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return normalized.slice(0, 180);
  const start = Math.max(0, idx - 60);
  const end = Math.min(normalized.length, idx + query.length + 120);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end)}${end < normalized.length ? "…" : ""}`;
};

const passesFilters = (
  entry: SessionEntry,
  types?: string[],
  roles?: string[],
): boolean => {
  if (types?.length && !types.includes(entry.type)) return false;
  if (roles?.length) {
    const role = entryRole(entry);
    if (!role || !roles.includes(role)) return false;
  }
  return true;
};

const isCheckpoint = (
  entry: SessionEntry,
): entry is Extract<SessionEntry, { type: "compaction" | "branch_summary" }> =>
  entry.type === "compaction" || entry.type === "branch_summary";

const findNode = (
  roots: SessionTreeNode[],
  id: string,
): SessionTreeNode | undefined => {
  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.entry.id === id) return node;
    for (const child of node.children) stack.push(child);
  }
  return undefined;
};

const getLeafEntries = (view: SessionView): SessionEntry[] =>
  flattenTree(view.getTree()).filter(
    (entry) => view.getChildren(entry.id).length === 0,
  );

const leafIdsContainingEntry = (view: SessionView, id: string): string[] =>
  getLeafEntries(view)
    .filter((leaf) => view.getBranch(leaf.id).some((entry) => entry.id === id))
    .map((leaf) => leaf.id);

export function getBranchEntries(
  view: SessionView,
  params: {
    leafId?: string;
    fromEnd?: boolean;
    limit?: number;
    types?: string[];
    roles?: string[];
  },
) {
  const limit = boundedLimit(params.limit, DEFAULT_BRANCH_LIMIT);
  let entries = view.getBranch(params.leafId);
  const totalBeforeFilters = entries.length;
  if (!params.fromEnd) entries = [...entries].reverse();
  entries = entries
    .filter((entry) => passesFilters(entry, params.types, params.roles))
    .slice(0, limit);

  const mainBranchIds = view.getMainBranchIds();
  return {
    entries: entries.map((entry) =>
      compactEntry(
        entry,
        view.getLabel(entry.id),
        view.getChildren(entry.id).length,
        mainBranchIds.has(entry.id),
      ),
    ),
    truncated: totalBeforeFilters > limit,
    limit,
    branchLeafId: params.leafId ?? view.mainLeafId,
  };
}

export function readEntry(
  view: SessionView,
  params: { id: string; maxChars?: number },
) {
  const entry = view.getEntry(params.id);
  if (!entry) throw new Error(`No entry found with id '${params.id}'`);

  const maxChars = Math.min(
    Math.max(1, params.maxChars ?? DEFAULT_ENTRY_MAX_CHARS),
    MAX_ENTRY_MAX_CHARS,
  );
  const serializedContent = JSON.stringify(fullEntryContent(entry));
  const truncated = serializedContent.length > maxChars;
  const content = truncated
    ? `${serializedContent.slice(0, maxChars - 1)}…`
    : serializedContent;
  const mainBranchIds = view.getMainBranchIds();

  return {
    entry: {
      ...compactEntry(
        entry,
        view.getLabel(entry.id),
        view.getChildren(entry.id).length,
        mainBranchIds.has(entry.id),
      ),
      childrenIds: view.getChildren(entry.id).map((child) => child.id),
      content,
      contentEncoding: "json-string" as const,
      contentTruncated: truncated,
      contentLength: serializedContent.length,
      maxChars,
    },
  };
}

export function findEntries(
  view: SessionView,
  params: {
    query: string;
    scope?: "main_branch" | "full_tree";
    leafId?: string;
    limit?: number;
  },
) {
  const entries =
    params.scope === "full_tree" ? view.entries : view.getBranch(params.leafId);
  const mainBranchIds = view.getMainBranchIds();
  const limit = boundedLimit(params.limit, DEFAULT_SEARCH_LIMIT);

  const matches = entries
    .map((entry) => ({ entry, text: entrySearchText(entry) }))
    .filter(({ text }) =>
      text.toLowerCase().includes(params.query.toLowerCase()),
    )
    .slice(0, limit)
    .map(({ entry, text }) => ({
      ...compactEntry(
        entry,
        view.getLabel(entry.id),
        view.getChildren(entry.id).length,
        mainBranchIds.has(entry.id),
      ),
      snippet: snippetFor(text, params.query),
    }));

  return { matches, limit };
}

export function getEntriesBetween(
  view: SessionView,
  params: {
    startId: string;
    endId?: string;
    limit?: number;
    fromEnd?: boolean;
    types?: string[];
    roles?: string[];
  },
) {
  const endId = params.endId ?? view.mainLeafId;
  if (!endId) throw new Error("Session has no main leaf");
  if (!view.getEntry(endId))
    throw new Error(`No entry found with id '${endId}'`);

  const branch = view.getBranch(endId).reverse();
  const startIndex = branch.findIndex((entry) => entry.id === params.startId);
  if (startIndex < 0) {
    const containingLeafIds = leafIdsContainingEntry(view, params.startId);
    const hint =
      containingLeafIds.length > 0
        ? ` Entry '${params.startId}' appears on branch leaf id(s): ${containingLeafIds
            .slice(0, 5)
            .join(
              ", ",
            )}. Retry with one of those as endId/leafId, or inspect that branch with get_branch_entries.`
        : "";
    throw new Error(
      `Start entry '${params.startId}' is not on branch '${endId}'. Pi sessions are trees; ranges only work when startId and endId are on the same branch.${hint}`,
    );
  }
  const endIndex = branch.findIndex((entry) => entry.id === endId);
  if (startIndex > endIndex) {
    throw new Error(
      `Start entry '${params.startId}' is after end entry '${endId}'`,
    );
  }

  const limit = boundedLimit(params.limit, DEFAULT_BRANCH_LIMIT);
  let entries = branch
    .slice(startIndex, endIndex + 1)
    .filter((entry) => passesFilters(entry, params.types, params.roles));
  const total = entries.length;
  if (params.fromEnd) entries = [...entries].reverse();
  entries = entries.slice(0, limit);

  const mainBranchIds = view.getMainBranchIds();
  return {
    entries: entries.map((entry) =>
      compactEntry(
        entry,
        view.getLabel(entry.id),
        view.getChildren(entry.id).length,
        mainBranchIds.has(entry.id),
      ),
    ),
    truncated: total > limit,
    limit,
    branchLeafId: endId,
  };
}

export function getTreeOutline(
  view: SessionView,
  params: {
    rootId?: string;
    maxDepth?: number;
    limit?: number;
    mainBranchOnly?: boolean;
    fromEnd?: boolean;
  },
) {
  const mainBranch = view.getBranch();
  const mainBranchIds = new Set(mainBranch.map((entry) => entry.id));
  const limit = boundedLimit(params.limit, DEFAULT_TREE_LIMIT);
  const maxDepth = Math.max(0, params.maxDepth ?? DEFAULT_MAX_DEPTH);

  if (params.mainBranchOnly) {
    const entries = params.fromEnd
      ? mainBranch.slice(0, limit)
      : [...mainBranch].reverse().slice(0, limit);
    return {
      entries: entries.map((entry, indexInBranch) => ({
        ...compactEntry(
          entry,
          view.getLabel(entry.id),
          view.getChildren(entry.id).length,
          true,
        ),
        depth: indexInBranch,
        childrenIds: view.getChildren(entry.id).map((child) => child.id),
        truncatedChildren: 0,
      })),
      truncated: mainBranch.length > limit,
      limit,
      maxDepth,
    };
  }

  const roots = view.getTree();
  const startNodes = params.rootId
    ? (() => {
        const node = findNode(roots, params.rootId);
        if (!node) throw new Error(`No entry found with id '${params.rootId}'`);
        return [node];
      })()
    : roots;

  const entries: Array<
    ReturnType<typeof compactEntry> & {
      depth: number;
      childrenIds: string[];
      truncatedChildren: number;
    }
  > = [];
  const stack = [...startNodes].reverse().map((node) => ({ node, depth: 0 }));

  while (stack.length > 0 && entries.length < limit) {
    const item = stack.pop();
    if (!item) continue;
    const { node, depth } = item;
    const childrenIds = node.children.map((child) => child.entry.id);
    const canExpand = depth < maxDepth;

    entries.push({
      ...compactEntry(
        node.entry,
        node.label ?? view.getLabel(node.entry.id),
        node.children.length,
        mainBranchIds.has(node.entry.id),
      ),
      depth,
      childrenIds,
      truncatedChildren: canExpand ? 0 : node.children.length,
    });

    if (!canExpand) continue;
    for (const child of [...node.children].reverse()) {
      stack.push({ node: child, depth: depth + 1 });
    }
  }

  return { entries, truncated: stack.length > 0, limit, maxDepth };
}

export function getSessionMap(
  view: SessionView,
  params: {
    maxBranches?: number;
    maxCheckpoints?: number;
    maxRecentPerBranch?: number;
  },
) {
  const maxBranches = boundedLimit(
    params.maxBranches,
    DEFAULT_SESSION_MAP_BRANCH_LIMIT,
  );
  const maxCheckpoints = boundedLimit(
    params.maxCheckpoints,
    DEFAULT_SESSION_MAP_CHECKPOINT_LIMIT,
  );
  const maxRecentPerBranch = boundedLimit(
    params.maxRecentPerBranch,
    DEFAULT_SESSION_MAP_RECENT_LIMIT,
  );
  const mainBranchIds = view.getMainBranchIds();
  const leaves = getLeafEntries(view);
  const mainLeafId = view.mainLeafId;

  const branches = leaves
    .map((leaf) => {
      const branch = view.getBranch(leaf.id);
      const rootToLeaf = [...branch].reverse();
      const firstOffMain = rootToLeaf.find(
        (entry) => !mainBranchIds.has(entry.id),
      );
      const branchPointId = firstOffMain?.parentId ?? undefined;
      const branchPoint = branchPointId
        ? view.getEntry(branchPointId)
        : undefined;
      const isMain = leaf.id === mainLeafId;

      return {
        leafId: leaf.id,
        isMain,
        depth: branch.length,
        branchPointId,
        branchPointPreview: branchPoint
          ? compactEntry(
              branchPoint,
              view.getLabel(branchPoint.id),
              view.getChildren(branchPoint.id).length,
              mainBranchIds.has(branchPoint.id),
            )
          : undefined,
        leafPreview: compactEntry(
          leaf,
          view.getLabel(leaf.id),
          view.getChildren(leaf.id).length,
          mainBranchIds.has(leaf.id),
        ),
        recentEntries: branch
          .slice(0, maxRecentPerBranch)
          .map((entry) =>
            compactEntry(
              entry,
              view.getLabel(entry.id),
              view.getChildren(entry.id).length,
              mainBranchIds.has(entry.id),
            ),
          ),
      };
    })
    .sort((a, b) => {
      if (a.isMain) return -1;
      if (b.isMain) return 1;
      return (
        new Date(b.leafPreview.timestamp).getTime() -
        new Date(a.leafPreview.timestamp).getTime()
      );
    });

  const checkpoints = getCheckpoints(view, {
    fromEnd: true,
    limit: maxCheckpoints,
  }).checkpoints;

  return {
    mainLeafId,
    entryCount: view.entries.length,
    branchCount: leaves.length,
    branches: branches.slice(0, maxBranches),
    branchesTruncated: branches.length > maxBranches,
    checkpoints,
    checkpointsTruncated:
      view.entries.filter(isCheckpoint).length > maxCheckpoints,
    limits: { maxBranches, maxCheckpoints, maxRecentPerBranch },
  };
}

export function getCheckpoints(
  view: SessionView,
  params: { fromEnd?: boolean; limit?: number },
) {
  const limit = boundedLimit(params.limit, DEFAULT_CHECKPOINT_LIMIT);
  let entries = view.entries.filter(isCheckpoint);
  if (params.fromEnd) entries = [...entries].reverse();
  entries = entries.slice(0, limit);

  const mainBranchIds = view.getMainBranchIds();
  return {
    checkpoints: entries.map((entry) => {
      const details =
        entry.details && typeof entry.details === "object"
          ? (entry.details as {
              readFiles?: string[];
              modifiedFiles?: string[];
            })
          : undefined;
      return {
        ...compactEntry(
          entry,
          view.getLabel(entry.id),
          view.getChildren(entry.id).length,
          mainBranchIds.has(entry.id),
        ),
        summaryPreview: truncate(entry.summary, SUMMARY_PREVIEW_LIMIT),
        firstKeptEntryId:
          entry.type === "compaction" ? entry.firstKeptEntryId : undefined,
        fromId: entry.type === "branch_summary" ? entry.fromId : undefined,
        tokensBefore:
          entry.type === "compaction" ? entry.tokensBefore : undefined,
        readFiles: details?.readFiles?.slice(0, 20),
        modifiedFiles: details?.modifiedFiles?.slice(0, 20),
      };
    }),
    limit,
  };
}

export function readCheckpoint(view: SessionView, params: { id: string }) {
  const entry = view.getEntry(params.id);
  if (!entry) throw new Error(`No entry found with id '${params.id}'`);
  if (!isCheckpoint(entry))
    throw new Error(`Entry '${params.id}' is not a checkpoint`);

  const mainBranchIds = view.getMainBranchIds();
  return {
    checkpoint: {
      ...compactEntry(
        entry,
        view.getLabel(entry.id),
        view.getChildren(entry.id).length,
        mainBranchIds.has(entry.id),
      ),
      firstKeptEntryId:
        entry.type === "compaction" ? entry.firstKeptEntryId : undefined,
      fromId: entry.type === "branch_summary" ? entry.fromId : undefined,
      tokensBefore:
        entry.type === "compaction" ? entry.tokensBefore : undefined,
      summary: entry.summary,
      details: entry.details,
    },
  };
}
