/** Prefix for local git branch autocomplete. */
export const GIT_BRANCH_PREFIX = "@g:";

/** Match `@g:` plus an optional token at end of text before cursor. */
export const GIT_BRANCH_TOKEN_RE = /@g:([^\s@]*)$/;

/** Maximum local branch suggestions shown for `@g:` completion. */
export const MAX_BRANCH_SUGGESTIONS = 20;
