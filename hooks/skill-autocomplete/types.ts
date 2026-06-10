/** Trigger character for skill autocomplete. */
export const SKILL_TRIGGER = "?";

/** Match `?<token>` at a token boundary (after space or at line start). */
export const SKILL_TOKEN_RE = /(?:^|\s)\?([^\s?]*)$/;
