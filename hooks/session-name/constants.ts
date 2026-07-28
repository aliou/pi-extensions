export const SESSION_NAME_CHANGE_TYPE = "session_name_change";
export interface SessionNameChangeCustomEntry {
  previousName: string | undefined;
  name: string;
}

export const SESSION_NAME_REFINE_EVERY = 10;

export const SESSION_NAME_MAX_TURNS = 10;

/**
 * Maximum wait for the naming subagent to start responding (first streaming
 * update). If no update arrives within this window the run is aborted so a
 * hung request does not block the session. The run is also cancelled when the
 * next turn starts, so this is a safety net for a silent model, not a hard
 * cap on a healthy run.
 */
export const SESSION_NAME_FIRST_TOKEN_TIMEOUT_MS = 15_000;
