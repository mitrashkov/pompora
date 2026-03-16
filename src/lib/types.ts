export type Theme = "dark" | "light";



export type CursorBlinking = "blink" | "smooth" | "phase" | "expand" | "solid";



export type AppSettings = {

  theme: Theme;

  offline_mode: boolean;

  active_provider: string | null;

  active_model?: string | null;

  pompora_thinking?: "slow" | "fast" | "reasoning" | string | null;

  editor_cursor_blinking?: CursorBlinking;

  editor_line_highlight_color?: string | null;

  editor_cursor_color?: string | null;

  keybindings?: Record<string, string>;

  workspace_root: string | null;

  workspace_roots?: string[];

  recent_workspaces: string[];

  saved_workspaces?: SavedWorkspace[];

};

export type SavedWorkspace = {
  name: string;
  roots: string[];
  updated_at?: number;
};





export type KeyStatus = {

  provider: string;

  is_configured: boolean;

  storage: "none" | "keyring" | "encryptedfile";

};



export type WorkspaceInfo = {

  root: string | null;

  roots?: string[];

  recent: string[];

};



export type DirEntryInfo = {

  path: string;

  name: string;

  is_dir: boolean;

};



export type EditorTab = {

  path: string;

  name: string;

  language: string;

  content: string;

  isDirty: boolean;

  kind?: "text" | "image";

  image?: {

    mime: string;

    url: string;

    dataUrl?: string;

  };

};



export type AuthProfile = {

  user_id: string;

  email: string;

  plan: string;

  avatar_url: string;

  first_name: string;

  last_name: string;

};



export type CreditsBucket = {

  limit: number;

  used: number;

  remaining: number;

  resets?: string | null;

  period?: string | null;

};



export type CreditsFast = {

  limit_month: number;

  used_month: number;

  remaining_month: number;

  daily_cap: number;

  used_today: number;

  remaining_today: number;

  period_month?: string | null;

  period_day?: string | null;

};



export type CreditsResponse = {

  plan: string;

  slow: CreditsBucket;

  fast: CreditsFast;

};

