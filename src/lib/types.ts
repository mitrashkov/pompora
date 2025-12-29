export type Theme = "dark" | "light";

export type AppSettings = {
  theme: Theme;
  offline_mode: boolean;
  active_provider: string | null;
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
