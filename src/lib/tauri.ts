import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, AuthProfile, CreditsResponse, DirEntryInfo, KeyStatus, WorkspaceInfo } from "./types";

export async function settingsGet(): Promise<AppSettings> {
  return invoke<AppSettings>("settings_get");
}

export async function settingsSet(next: AppSettings): Promise<void> {
  await invoke("settings_set", { next });
}

export async function providerKeyStatus(provider: string): Promise<KeyStatus> {
  return invoke<KeyStatus>("provider_key_status", { provider });
}

export async function providerKeySet(args: {
  provider: string;
  apiKey: string;
  encryptionPassword?: string;
}): Promise<void> {
  await invoke("provider_key_set", {
    provider: args.provider,
    apiKey: args.apiKey,
    encryptionPassword: args.encryptionPassword ?? null,
  });
}

export async function aiChat(args: {
  messages: AiChatMessage[];
  encryptionPassword?: string;
  thinking?: string | null;
}): Promise<AiChatResult> {
  return invoke<AiChatResult>("ai_chat", {
    messages: args.messages,
    encryptionPassword: args.encryptionPassword ?? null,
    thinking: args.thinking ?? null,
  });
}

export async function aiChatWithModel(args: {
  messages: AiChatMessage[];
  model?: string | null;
  encryptionPassword?: string;
  thinking?: string | null;
}): Promise<AiChatResult> {
  return invoke<AiChatResult>("ai_chat_with_model", {
    messages: args.messages,
    model: args.model ?? null,
    encryptionPassword: args.encryptionPassword ?? null,
    thinking: args.thinking ?? null,
  });
}

export type OpenRouterModelInfo = {
  id: string;
};

export async function openrouterListModels(): Promise<OpenRouterModelInfo[]> {
  return invoke<OpenRouterModelInfo[]>("openrouter_list_models", {});
}

export async function providerKeyClear(provider: string): Promise<void> {
  return invoke<void>("provider_key_clear", { provider });
}

export async function authBeginLogin(): Promise<[string, string]> {
  return invoke<[string, string]>("auth_begin_login");
}

export async function authWaitLogin(state: string): Promise<AuthProfile> {
  return invoke<AuthProfile>("auth_wait_login", { state });
}

export async function authGetProfile(): Promise<AuthProfile | null> {
  return invoke<AuthProfile | null>("auth_get_profile");
}

export async function authLogout(): Promise<void> {
  return invoke<void>("auth_logout");
}

export async function authGetCredits(): Promise<CreditsResponse> {
  return invoke<CreditsResponse>("auth_get_credits");
}

export async function debugGeminiEndToEnd(apiKey: string): Promise<string> {
  return invoke<string>("debug_gemini_end_to_end", { apiKey });
}

export async function testGeminiApi(): Promise<string> {
  return invoke<string>("test_gemini_api", {});
}

export async function workspaceGet(): Promise<WorkspaceInfo> {
  return invoke<WorkspaceInfo>("workspace_get");
}

export async function workspacePickFolder(): Promise<string | null> {
  return invoke<string | null>("workspace_pick_folder");
}

export async function workspacePickFile(): Promise<string | null> {
  return invoke<string | null>("workspace_pick_file");
}

export async function workspaceSet(root: string | null): Promise<WorkspaceInfo> {
  return invoke<WorkspaceInfo>("workspace_set", { root });
}

export async function workspaceListDir(relDir?: string): Promise<DirEntryInfo[]> {
  return invoke<DirEntryInfo[]>("workspace_list_dir", {
    relDir: relDir ?? null,
  });
}

export async function workspaceListFiles(maxFiles?: number): Promise<string[]> {
  return invoke<string[]>("workspace_list_files", {
    maxFiles: maxFiles ?? null,
  });
}

export async function workspaceReadFile(relPath: string): Promise<string> {
  return invoke<string>("workspace_read_file", { relPath });
}

export async function workspaceWriteFile(relPath: string, contents: string): Promise<void> {
  await invoke("workspace_write_file", { relPath, contents });
}

export async function workspaceCreateDir(relPath: string): Promise<void> {
  await invoke("workspace_create_dir", { relPath });
}

export async function workspaceDelete(relPath: string): Promise<void> {
  await invoke("workspace_delete", { relPath });
}

export async function workspaceRename(fromRel: string, toRel: string): Promise<void> {
  await invoke("workspace_rename", { fromRel, toRel });
}

export type WorkspaceSearchMatch = {
  path: string;
  line: number;
  text: string;
};

export async function workspaceSearch(query: string, maxResults?: number): Promise<WorkspaceSearchMatch[]> {
  return invoke<WorkspaceSearchMatch[]>("workspace_search", {
    query,
    maxResults: maxResults ?? null,
  });
}

export async function terminalStart(args: { cols: number; rows: number; cwd?: string | null }): Promise<string> {
  return invoke<string>("terminal_start", {
    cols: args.cols,
    rows: args.rows,
    cwd: args.cwd ?? null,
  });
}

export async function terminalWrite(args: { id: string; data: string }): Promise<void> {
  await invoke("terminal_write", { id: args.id, data: args.data });
}

export async function terminalResize(args: { id: string; cols: number; rows: number }): Promise<void> {
  await invoke("terminal_resize", { id: args.id, cols: args.cols, rows: args.rows });
}

export async function terminalKill(args: { id: string }): Promise<void> {
  await invoke("terminal_kill", { id: args.id });
}

export type AiRunResult = {
  output: string;
  updated_content: string | null;
};

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiEditOp = {
  op: "write" | "delete" | "rename" | string;
  path?: string;
  content?: string;
  from?: string;
  to?: string;
};

export type AiChatResult = {
  output: string;
  edits?: AiEditOp[] | null;
};

export async function aiRunAction(args: {
  action: "explain" | "fix" | "refactor" | "tests" | "docs" | "commit";
  relPath?: string;
  content: string;
  selection?: string;
  encryptionPassword?: string;
  thinking?: string | null;
}): Promise<AiRunResult> {
  return invoke<AiRunResult>("ai_run_action", {
    action: args.action,
    relPath: args.relPath ?? null,
    content: args.content,
    selection: args.selection ?? null,
    encryptionPassword: args.encryptionPassword ?? null,
    thinking: args.thinking ?? null,
  });
}
