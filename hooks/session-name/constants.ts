export const SESSION_NAME_CHANGE_TYPE = "session_name_change";
export interface SessionNameChangeCustomEntry {
  previousName: string | undefined;
  name: string;
}

export const SESSION_NAME_REFINE_EVERY = 5;

export const SESSION_NAME_MAX_TURNS = 5;
