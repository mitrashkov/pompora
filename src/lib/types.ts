export type Theme = "dark" | "light";

export type AppSettings = {
  theme: Theme;
  offline_mode: boolean;
  active_provider: string | null;
  pompora_thinking?: "slow" | "fast" | "reasoning" | string | null;
  workspace_root: string | null;
  recent_workspaces: string[];
};

export type KeyStatus = {
  provider: string;
  is_configured: boolean;
  storage: "none" | "keyring" | "encryptedfile";
};

export type WorkspaceInfo = {
  root: string | null;
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
};

export type AuthProfile = {
  user_id: string;
  email: string;
  plan: string;
  avatar_url: string;
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
