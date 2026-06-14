/** Prefix for tmux session autocomplete. */
export const TMUX_PREFIX = "@tmux:";

/** Match `@tmux:<token>` at end of text before cursor. */
export const TMUX_TOKEN_RE = /@tmux:([^\s@]*)$/;

/** Maximum suggestions shown. */
export const MAX_SUGGESTIONS = 20;
