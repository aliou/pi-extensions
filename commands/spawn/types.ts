/**
 * Session link types and constants for the spawn command.
 *
 * Marker entries go in the parent session (pointing to the child).
 * Source entries go in the child session (pointing to the parent).
 */

export type SessionLinkType = "handoff" | "continue";

export const SESSION_LINK_MARKER_TYPE = "session-link-marker";
export const SESSION_LINK_SOURCE_TYPE = "session-link-source";

export interface SessionLinkMarkerDetails {
  targetSessionFile: string;
  goal: string;
  linkType: SessionLinkType;
}

export interface SessionLinkSourceDetails {
  parentSessionFile: string;
  goal: string;
  linkType: SessionLinkType;
}

export interface SessionLinkMessage {
  customType: string;
  content: string | Array<{ type: string; text?: string }>;
  details?: Record<string, unknown>;
}
