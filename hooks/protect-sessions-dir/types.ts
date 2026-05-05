export type SessionAccessRequest = {
  /** Absolute session-dir paths extracted from the tool call. */
  targets: string[];
  /** Path or command string shown in the dialog and events. */
  displayTarget: string;
  /** True when no specific paths could be extracted (e.g. variable expansion). */
  ambiguous: boolean;
};

export type SessionGateResult =
  | "allow-once"
  | "allow-path"
  | "allow-all"
  | "deny";
