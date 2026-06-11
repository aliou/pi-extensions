import type {
  SessionEntry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

export type { SessionEntry };
export type SessionTreeNode = ReturnType<SessionManager["getTree"]>[number];

export type SessionReader = Pick<
  SessionManager,
  "getEntries" | "getLabel" | "getChildren" | "getTree"
>;

export type SessionView = {
  entries: SessionEntry[];
  mainLeafId?: string;
  getEntry(id: string): SessionEntry | undefined;
  getChildren(id: string): SessionEntry[];
  getLabel(id: string): string | undefined;
  getBranch(leafId?: string): SessionEntry[];
  getTree(): SessionTreeNode[];
  getMainBranchIds(): Set<string>;
};

export type CompactEntry = {
  id: string;
  parentId: string | null;
  timestamp: string;
  type: string;
  role?: string;
  label?: string;
  childCount?: number;
  isMainBranch?: boolean;
  preview: string;
};
