import type {
  SessionEntry,
  SessionReader,
  SessionTreeNode,
  SessionView,
} from "./types";

const labelMapFromEntries = (entries: SessionEntry[]): Map<string, string> => {
  const labels = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type === "label" && entry.label) {
      labels.set(entry.targetId, entry.label);
    }
  }
  return labels;
};

const createTree = (
  entries: SessionEntry[],
  labels: Map<string, string>,
): SessionTreeNode[] => {
  const nodeMap = new Map<string, SessionTreeNode>();
  const roots: SessionTreeNode[] = [];

  for (const entry of entries) {
    nodeMap.set(entry.id, {
      entry,
      children: [],
      label: labels.get(entry.id),
    });
  }

  for (const entry of entries) {
    const node = nodeMap.get(entry.id);
    if (!node) continue;
    if (!entry.parentId || entry.parentId === entry.id) {
      roots.push(node);
      continue;
    }

    const parent = nodeMap.get(entry.parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    node.children.sort(
      (a, b) =>
        new Date(a.entry.timestamp).getTime() -
        new Date(b.entry.timestamp).getTime(),
    );
    for (const child of node.children) stack.push(child);
  }

  return roots;
};

export function createSessionView(
  entries: SessionEntry[],
  options: {
    labels?: Map<string, string>;
    getTree?: () => SessionTreeNode[];
    getChildren?: (id: string) => SessionEntry[];
  } = {},
): SessionView {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const childrenById = new Map<string, SessionEntry[]>();
  const resolvedLabels = options.labels ?? labelMapFromEntries(entries);

  for (const entry of entries) {
    if (!entry.parentId || entry.parentId === entry.id) continue;
    const children = childrenById.get(entry.parentId) ?? [];
    children.push(entry);
    childrenById.set(entry.parentId, children);
  }

  for (const children of childrenById.values()) {
    children.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  const mainLeafId = entries.at(-1)?.id;

  const getBranch = (leafId = mainLeafId): SessionEntry[] => {
    if (!leafId) return [];
    const branch: SessionEntry[] = [];
    const seen = new Set<string>();
    let entry = byId.get(leafId);

    while (entry && !seen.has(entry.id)) {
      branch.push(entry);
      seen.add(entry.id);
      if (!entry.parentId || entry.parentId === entry.id) break;
      entry = byId.get(entry.parentId);
    }

    return branch;
  };

  const getChildren =
    options.getChildren ?? ((id) => childrenById.get(id) ?? []);

  return {
    entries,
    mainLeafId,
    getEntry: (id) => byId.get(id),
    getChildren,
    getLabel: (id) => resolvedLabels.get(id),
    getBranch,
    getMainBranchIds: () => new Set(getBranch().map((entry) => entry.id)),
    getTree: options.getTree ?? (() => createTree(entries, resolvedLabels)),
  };
}

export function createSessionViewFromSession(
  session: SessionReader,
): SessionView {
  const entries = session.getEntries();
  return createSessionView(entries, {
    labels: new Map(
      entries
        .map((entry) => [entry.id, session.getLabel(entry.id)])
        .filter(
          (item): item is [string, string] => typeof item[1] === "string",
        ),
    ),
    getChildren: (id) => session.getChildren(id),
    getTree: () => session.getTree(),
  });
}

export const flattenTree = (nodes: SessionTreeNode[]): SessionEntry[] => {
  const entries: SessionEntry[] = [];
  const stack = [...nodes].reverse();

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    entries.push(node.entry);
    for (const child of [...node.children].reverse()) {
      stack.push(child);
    }
  }

  return entries;
};
