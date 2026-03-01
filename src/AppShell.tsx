import React, { Component, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type ReactElement } from "react";

import { createPortal } from "react-dom";

import Editor, { DiffEditor } from "@monaco-editor/react";

import type { editor as MonacoEditorNS } from "monaco-editor";

import { listen } from "@tauri-apps/api/event";

import { Icon as IconifyIcon } from "@iconify/react";

import siTypescript from "@iconify/icons-simple-icons/typescript";

import siJavascript from "@iconify/icons-simple-icons/javascript";

import siReact from "@iconify/icons-simple-icons/react";

import siHtml5 from "@iconify/icons-simple-icons/html5";

import siCss3 from "@iconify/icons-simple-icons/css3";

import siJson from "@iconify/icons-simple-icons/json";

import siMarkdown from "@iconify/icons-simple-icons/markdown";

import siRust from "@iconify/icons-simple-icons/rust";

import siDocker from "@iconify/icons-simple-icons/docker";

import siGit from "@iconify/icons-simple-icons/git";

import siNpm from "@iconify/icons-simple-icons/npm";

import siYarn from "@iconify/icons-simple-icons/yarn";

import siPnpm from "@iconify/icons-simple-icons/pnpm";

import siVite from "@iconify/icons-simple-icons/vite";

import siTailwindcss from "@iconify/icons-simple-icons/tailwindcss";

import siTauri from "@iconify/icons-simple-icons/tauri";

import siDotenv from "@iconify/icons-simple-icons/dotenv";

import siYaml from "@iconify/icons-simple-icons/yaml";

import siToml from "@iconify/icons-simple-icons/toml";

import siEslint from "@iconify/icons-simple-icons/eslint";

import siPrettier from "@iconify/icons-simple-icons/prettier";

import siGnubash from "@iconify/icons-simple-icons/gnubash";

import siPython from "@iconify/icons-simple-icons/python";

import siGo from "@iconify/icons-simple-icons/go";

import siJava from "@iconify/icons-simple-icons/openjdk";

import siC from "@iconify/icons-simple-icons/c";

import siCplusplus from "@iconify/icons-simple-icons/cplusplus";

import { Terminal as XTermTerminal } from "xterm";

import { FitAddon } from "xterm-addon-fit";

import {

  AlertTriangle,

  ArrowLeft,

  ArrowRight,

  ArrowUp,

  Bell,

  ChevronDown,

  ChevronLeft,

  ChevronRight,

  Check,

  Clipboard,

  FileText,

  Folder,

  FolderOpen,

  GitBranch,

  History,

  Maximize2,

  Minus,

  Pencil,

  Plus,

  RotateCw,

  Search,

  Settings as SettingsIcon,

  Terminal,

  Trash2,

  ThumbsDown,

  ThumbsUp,

  Wand2,

  X,

} from "lucide-react";

import { getCurrentWindow } from "@tauri-apps/api/window";

import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

import { openUrl } from "@tauri-apps/plugin-opener";

import {

  providerKeyClear,

  providerKeySet,

  providerKeyStatus,

  authBeginLogin,

  authWaitLogin,

  authGetProfile,

  authLogout,

  authClear,

  authGetCredits,

  authAvatarDataUrl,

  debugGeminiEndToEnd,

  aiChat,

  settingsGet,

  settingsSet,

  settingsClear,

  historyGetRaw,

  historySetRaw,

  historyClear,

  providerKeysClearAll,

  appWipeAll,

  workspaceGet,

  workspaceListDir,

  workspaceListFiles,

  workspaceReadFile,

  workspaceReadFileBase64,

  workspaceWriteFile,

  workspaceWriteFileBase64,

  workspaceCreateDir,

  workspaceDelete,

  workspaceRename,

  workspaceSearch,

  workspacePickFile,

  workspacePickFolder,

  workspaceSet,

  workspaceAddRoot,

  workspaceRemoveRoot,

  fsReadFileAbs,

  fsReadFileAbsBase64,

  clipboardWriteText,

  clipboardReadText,

  wslClipboardWriteText,

  wslClipboardReadText,

  terminalStart,

  terminalWrite,

  terminalResize,

  terminalKill,

  providerListModels,

} from "./lib/tauri";

import type { AiChatMessage, AiEditOp } from "./lib/tauri";

import type { AppSettings, AuthProfile, CreditsResponse, CursorBlinking, DirEntryInfo, EditorTab, KeyStatus, SavedWorkspace, Theme, WorkspaceInfo } from "./lib/types";



type ActivityId = "explorer" | "search" | "scm";



const DEFAULT_KEYBINDINGS: Record<string, string> = {

  "chat.toggle": "Ctrl+L",

  "view.commandPalette": "Ctrl+Shift+P",



  "view.navigateBack": "Alt+ArrowLeft",

  "view.navigateForward": "Alt+ArrowRight",



  "file.newWindow": "Ctrl+Shift+N",

  "file.openFile": "Ctrl+O",

  "file.openFolder": "Ctrl+K Ctrl+O",



  "file.save": "Ctrl+S",

  "file.saveAs": "Ctrl+Shift+S",

  "file.saveAll": "Ctrl+K S",



  "file.close": "Ctrl+W",

  "file.closeAll": "Ctrl+K Ctrl+W",

  "window.close": "Alt+F4",



  "edit.undo": "Ctrl+Z",

  "edit.redo": "Ctrl+Y",

  "edit.cut": "Ctrl+X",

  "edit.copy": "Ctrl+C",

  "edit.paste": "Ctrl+V",

  "edit.selectAll": "Ctrl+A",



  "find.find": "Ctrl+F",

  "find.replace": "Ctrl+H",

  "workbench.findInFiles": "Ctrl+Shift+F",

  "workbench.replaceInFiles": "Ctrl+Shift+H",



  "editor.toggleLineComment": "Ctrl+/",

  "editor.toggleBlockComment": "Shift+Alt+A",

  "emmet.expandAbbreviation": "Tab",



  "editor.expandSelection": "Shift+Alt+ArrowRight",

  "editor.copyLineUp": "Shift+Alt+ArrowUp",

  "editor.copyLineDown": "Shift+Alt+ArrowDown",

  "editor.moveLineUp": "Alt+ArrowUp",

  "editor.moveLineDown": "Alt+ArrowDown",



  "editor.addCursorAbove": "Ctrl+Alt+ArrowUp",

  "editor.addCursorBelow": "Ctrl+Alt+ArrowDown",

  "editor.addCursorsToLineEnds": "Shift+Alt+I",

  "editor.selectAllOccurrences": "Ctrl+Shift+L",



  "view.fullScreen": "F11",

  "view.zenMode": "Ctrl+K Z",

  "editor.toggleWordWrap": "Alt+Z",

  "view.primarySidebar": "Ctrl+B",

  "view.explorer": "Ctrl+Shift+E",

  "view.search": "Ctrl+Shift+F",

  "view.sourceControl": "Ctrl+Shift+G",

  "view.runDebug": "Ctrl+Shift+D",

  "view.extensions": "Ctrl+Shift+X",



  "panel.problems": "Ctrl+Shift+M",

  "panel.output": "Ctrl+Shift+U",

  "panel.debugConsole": "Ctrl+Shift+Y",

  "terminal.toggle": "Ctrl+`",

  "terminal.new": "Ctrl+Shift+`",

  "terminal.split": "Ctrl+Shift+5",

  "terminal.newWindow": "Ctrl+Shift+Alt+`",



  "debug.start": "F5",

  "debug.runWithout": "Ctrl+F5",

  "debug.stop": "Shift+F5",

  "debug.restart": "Ctrl+Shift+F5",

  "tasks.build": "Ctrl+Shift+B",



  "view.zoomIn": "Ctrl+=",

  "view.zoomOut": "Ctrl+-",

  "view.zoomReset": "Ctrl+0",

  "view.splitEditor": "Ctrl+\\",

  "view.splitEditorInGroup": "Ctrl+K Ctrl+\\",

  "view.flipLayout": "Shift+Alt+0",

  "file.quickOpen": "Ctrl+P",

  "editor.gotoLine": "Ctrl+G",

  "view.settings": "Ctrl+,",

};



function SavedWorkspacesDialog(props: {

  items: SavedWorkspace[];

  onClose: () => void;

  onPick: (name: string) => void;

  onRename: (name: string) => void;

  onDelete: (name: string) => void;

}) {

  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "Escape") {

        e.preventDefault();

        props.onClose();

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [props]);



  return (

    <div className="fixed inset-0 z-50 bg-black/50" onMouseDown={props.onClose}>

      <div

        className="mx-auto mt-16 flex w-[520px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border/80 bg-panel shadow-2xl shadow-black/35"

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className="px-5 py-4">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <div className="text-[15px] font-semibold text-text">Saved Workspaces</div>

              <div className="mt-1 text-[12px] text-muted">Pick one to open</div>

            </div>

            <button

              type="button"

              className="ws-titlebar-window-btn hover:bg-red-500/15 hover:text-red-300"

              onClick={props.onClose}

              aria-label="Close"

            >

              <X className="h-4 w-4" />

            </button>

          </div>

        </div>



        <div className="max-h-[58vh] min-h-0 flex-1 p-2">

          {props.items.length ? (

            <div className="h-full overflow-auto px-1">

              {props.items.map((w) => (

                <div

                  key={w.name}

                  className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 hover:bg-bg/40"

                >

                  <button

                    type="button"

                    className="min-w-0 flex-1 text-left"

                    onClick={() => props.onPick(w.name)}

                  >

                    <div className="truncate text-[13px] font-medium text-text">{w.name}</div>

                    <div className="mt-1 space-y-0.5 text-[11px] text-muted">

                      {(w.roots ?? []).slice(0, 2).map((r) => (

                        <div key={r} className="truncate">

                          {r}

                        </div>

                      ))}

                      {(w.roots ?? []).length > 2 ? (

                        <div className="text-[10px] text-muted/80">+{(w.roots ?? []).length - 2} more</div>

                      ) : null}

                    </div>

                  </button>

                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                    <button type="button" className="ws-icon-btn" aria-label="Rename" onClick={() => props.onRename(w.name)}>

                      <Pencil className="h-4 w-4" />

                    </button>

                    <button type="button" className="ws-icon-btn" aria-label="Delete" onClick={() => props.onDelete(w.name)}>

                      <Trash2 className="h-4 w-4" />

                    </button>

                  </div>

                </div>

              ))}
            </div>

          ) : (

            <div className="p-5 text-[13px] text-muted">No saved workspaces yet</div>

          )}

        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4">

          <div className="text-[11px] text-muted">Esc to close</div>

          <div className="flex items-center gap-2">

            <button type="button" className="ws-btn ws-btn-secondary h-9 px-5" onClick={props.onClose}>

              Close

            </button>

          </div>

        </div>

      </div>

    </div>

  );
}



function __normShortcut(raw: string): string {

  const s = String(raw || "")

    .trim()

    .replace(/\s+/g, " ");

  if (!s) return "";



  const normPart = (part: string) => {

    const bits = part

      .split("+")

      .map((x) => x.trim())

      .filter(Boolean);

    if (!bits.length) return "";



    const modOrder = ["Ctrl", "Shift", "Alt", "Win"];

    const mods = new Set<string>();

    let key = "";

    for (const b of bits) {

      const c = b.length === 1 ? b.toUpperCase() : b;

      if (modOrder.includes(c)) mods.add(c);

      else if (!key) key = c;

    }



    const ordered = modOrder.filter((m) => mods.has(m));

    return [...ordered, key].filter(Boolean).join("+");

  };



  return s

    .split(" ")

    .map((p) => normPart(p))

    .filter(Boolean)

    .join(" ");

}



function TextPromptDialog(props: {

  title: string;

  subtitle?: string;

  placeholder?: string;

  value: string;

  setValue: (v: string) => void;

  password?: boolean;

  readOnly?: boolean;

  showCopy?: boolean;

  onClose: () => void;

  onSubmit: (value: string) => void;

}) {

  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "Escape") {

        e.preventDefault();

        props.onClose();

      }

      if (e.key === "Enter") {

        e.preventDefault();

        if (props.readOnly) return;

        const v = String(props.value ?? "");

        props.onSubmit(v);

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [props]);



  const canSubmit = !props.readOnly;



  return (

    <div className="fixed inset-0 z-50 bg-black/50" onMouseDown={props.onClose}>

      <div

        className="mx-auto mt-16 w-[520px] max-w-[92vw] overflow-hidden rounded-2xl border border-border/80 bg-panel shadow-2xl shadow-black/35"

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className="px-5 py-4">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <div className="text-[15px] font-semibold text-text">{props.title}</div>

              {props.subtitle ? <div className="mt-1 text-[12px] text-muted">{props.subtitle}</div> : null}

            </div>

            <button

              type="button"

              className="ws-titlebar-window-btn hover:bg-red-500/15 hover:text-red-300"

              onClick={props.onClose}

              aria-label="Close"

            >

              <X className="h-4 w-4" />

            </button>

          </div>

        </div>



        <div className="px-5 pb-4">

          <div className="mt-2 flex items-stretch gap-2">

            <input

              className="h-10 w-full rounded-xl border border-border/70 bg-panel2 px-3 text-sm text-text placeholder:text-muted focus:outline-none"

              placeholder={props.placeholder ?? ""}

              autoFocus

              value={props.value}

              readOnly={!!props.readOnly}

              type={props.password ? "password" : "text"}

              onChange={(e) => props.setValue(e.currentTarget.value)}

            />

          </div>

        </div>



        <div className="flex items-center justify-between gap-2 px-5 py-4">

          <div className="text-[11px] text-muted">{props.readOnly ? "Esc to close" : "Enter to confirm • Esc to cancel"}</div>

          <div className="flex items-center gap-2">

            {props.showCopy ? (

              <button

                type="button"

                className="ws-btn ws-btn-secondary h-9 px-4"

                onClick={() => {

                  void navigator.clipboard.writeText(String(props.value ?? "")).catch(() => {});

                }}

              >

                Copy

              </button>

            ) : null}

            <button

              type="button"

              className="ws-btn ws-btn-secondary h-9 px-4 hover:bg-red-500/15 hover:text-red-300"

              onClick={props.onClose}

            >

              {props.readOnly ? "Close" : "Cancel"}

            </button>

            {canSubmit ? (

              <button

                type="button"

                className="ws-btn h-9 bg-[#2563EB] px-4 text-white hover:bg-[#2563EB]/80"

                onClick={() => props.onSubmit(String(props.value ?? ""))}

              >

                OK

              </button>

            ) : null}

          </div>

        </div>

      </div>

    </div>

  );
}



function ConfirmDialog(props: {

  title: string;

  message: string;

  confirmLabel?: string;

  danger?: boolean;

  onClose: () => void;

  onConfirm: () => void;

}) {

  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "Escape") {

        e.preventDefault();

        props.onClose();

      }

      if (e.key === "Enter") {

        e.preventDefault();

        props.onConfirm();

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [props]);



  const confirmLabel = props.confirmLabel ?? "OK";

  const confirmClass = props.danger

    ? "ws-btn h-9 border border-red-500/60 bg-red-500/20 px-4 text-red-200 hover:bg-red-500/25"

    : "ws-btn h-9 bg-[#2563EB] px-4 text-white hover:bg-[#2563EB]/80";



  return (

    <div className="fixed inset-0 z-50 bg-black/50" onMouseDown={props.onClose}>

      <div

        className="mx-auto mt-16 w-[520px] max-w-[92vw] overflow-hidden rounded-2xl border border-border/80 bg-panel shadow-2xl shadow-black/35"

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className="px-5 py-4">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <div className="text-[15px] font-semibold text-text">{props.title}</div>

            </div>

            <button

              type="button"

              className="ws-titlebar-window-btn hover:bg-red-500/15 hover:text-red-300"

              onClick={props.onClose}

              aria-label="Close"

            >

              <X className="h-4 w-4" />

            </button>

          </div>

        </div>



        <div className="px-5 pb-4">

          <div className="text-sm text-muted whitespace-pre-wrap">{props.message}</div>

        </div>



        <div className="flex items-center justify-between gap-2 px-5 py-4">

          <div className="text-[11px] text-muted">Enter to confirm • Esc to cancel</div>

          <div className="flex items-center gap-2">

            <button

              type="button"

              className="ws-btn ws-btn-secondary h-9 px-4 hover:bg-red-500/15 hover:text-red-300"

              onClick={props.onClose}

            >

              Cancel

            </button>

            <button type="button" className={confirmClass} onClick={props.onConfirm}>

              {confirmLabel}

            </button>

          </div>

        </div>

      </div>

    </div>

  );

}



function __eventToShortcut(e: KeyboardEvent): string {

  const rawKey = String((e as any).key || "");

  if (rawKey === "Control" || rawKey === "Shift" || rawKey === "Alt" || rawKey === "Meta") return "";



  const parts: string[] = [];

  if (e.ctrlKey) parts.push("Ctrl");

  if (e.shiftKey) parts.push("Shift");

  if (e.altKey) parts.push("Alt");

  if (e.metaKey) parts.push("Win");



  const k = rawKey;

  const code = String((e as any).code || "");

  const key = (() => {

    if (k === " ") return "Space";

    if (k === "Esc") return "Escape";

    if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") return k;

    if (k === "Enter" || k === "Tab" || k === "Backspace" || k === "Delete" || k === "Escape") return k;

    if (code === "Backquote") return "`";

    if (code === "Backslash") return "\\";

    return k.length === 1 ? k.toUpperCase() : k;

  })();



  if (!key) return "";

  parts.push(key);

  return parts.join("+");

}



// ProviderModelPicker removed (unused)



type ChatLogEntry = {

  id: string;

  ts: number;

  groupId?: string | null;

  kind: "info" | "error" | "action";

  title: string;

  status?: "pending" | "running" | "done" | "error";

  details?: string[];

  collapsed?: boolean;

};



type ChatSession = {

  id: string;

  title: string;

  createdAt: number;

  updatedAt: number;

  messages: ChatUiMessage[];

  logs: ChatLogEntry[];

  draft: string;

  changeSet: ChangeSet | null;

};



type Command = {

  id: string;

  label: string;

  shortcut?: string;

  run: () => void;

};



type AppNotification = {

  id: string;

  title: string;

  message: string;

  kind: "error" | "info";

};



 type ChatUiMessage = {

  role: "user" | "assistant" | "meta";

  content: string;

  id?: string;

  rating?: "up" | "down" | null;

  kind?: "run_request" | "activity" | "event_stream";

  run?: {

    cmd: string;

    status: "pending" | "running" | "done" | "canceled";

    remaining: string[];

    error?: string | null;

    tail?: string[] | null;

    autoFixRequested?: boolean;

  };

  activity?: {

    title: string;

    status: "pending" | "running" | "done" | "error";

    steps: string[];

    details?: string[];

    collapsed?: boolean;

    progress?: { done: number; total: number; current?: string };

  };

  eventStream?: {

    status: "running" | "done" | "error";

    events: ChatEvent[];

  };

};



type ChatEventBase = {

  id: string;

  ts: number;

};



type ChatEvent =

  | (ChatEventBase & { type: "message"; content: string })

  | (ChatEventBase & { type: "state"; content: string; hidden?: boolean; ttlMs?: number })

  | (ChatEventBase & { type: "file_edit"; file: string; added: number; removed: number });



type TerminalCapture = {

  id: string;

  startedAt: number;

  lastDataAt: number;

  lastFlushAt: number;

  buffer: string;

  emitted: number;

  maxEmitted: number;

  emit: (line: string) => void;

};



type AiEventInput =

  | { type: "message"; content: string }

  | { type: "state"; content: string; hidden?: boolean; ttlMs?: number }

  | { type: "file_edit"; file: string; added: number; removed: number };



function ImageTabView(props: {

  tab: EditorTab;

  onFit: () => void;

  onZoomIn: () => void;

  onZoomOut: () => void;

  onReset: () => void;

  onOpenAsText: () => void;

  onRefresh: () => void;

  zoomLabel: string;

  scale: number;

  onSetScale: (s: number) => void;

  offset: { x: number; y: number };

  naturalSize: { w: number; h: number } | null;

  containerRef: React.RefObject<HTMLDivElement | null>;

  onWheel: (e: React.WheelEvent) => void;

  onPointerDown: (e: React.PointerEvent) => void;

  onPointerMove: (e: React.PointerEvent) => void;

  onPointerUp: (e: React.PointerEvent) => void;

  onPointerCancel: (e: React.PointerEvent) => void;

  transform: string;

}) {

  const url = props.tab.image?.url ?? "";

  const [err, setErr] = useState<string | null>(null);



  useEffect(() => {

    setErr(null);

  }, [props.tab.path, props.tab.image?.url]);



  const stop = useCallback((e: any) => {

    e.preventDefault?.();

    e.stopPropagation?.();

  }, []);



  return (

    <div className="absolute inset-0">

      <div className="relative h-full w-full">

        <div

          ref={props.containerRef}

          className="absolute inset-0 overflow-hidden bg-bg"

          onWheel={props.onWheel}

          onPointerDown={props.onPointerDown}

          onPointerMove={props.onPointerMove}

          onPointerUp={props.onPointerUp}

          onPointerCancel={props.onPointerCancel}

          style={{ touchAction: "none", cursor: "grab" }}

        >

          <div className="relative h-full w-full">

            <div className="h-full w-full select-none" style={{ transform: props.transform, transformOrigin: "0 0" }}>

              {url ? (

                <div className="relative inline-block">

                  <img

                    src={url}

                    alt={props.tab.name}

                    draggable={false}

                    className="max-w-none"

                    style={{ imageRendering: "auto" }}

                    onError={() => setErr("Your system can't decode this image format in the app viewer.")}

                  />

                </div>

              ) : (

                <div className="p-4 text-sm text-muted">No image data.</div>

              )}

            </div>



            {err || !url ? (

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">

                <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-border bg-panel/90 p-5 shadow-2xl">

                  <div className="flex items-start gap-3">

                    <div className="mt-0.5 rounded-xl bg-bg p-2">

                      <AlertTriangle className="h-5 w-5 text-muted" />

                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="text-sm font-medium text-text">Can’t display this image</div>

                      <div className="mt-1 text-sm text-muted">

                        {err ? err : "The file didn’t load any image data. It may be empty, missing, or not accessible."}

                      </div>

                      <div className="mt-2 text-sm text-muted">

                        You can reload the file, or open it as text. Some formats (like HEIC/AVIF) may require additional codecs.

                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">

                        <button type="button" className="ws-btn" onClick={props.onRefresh}>

                          Reload

                        </button>

                        <button type="button" className="ws-btn" onClick={props.onOpenAsText}>

                          Open as Text

                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            ) : null}



            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center">

              <div

                className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-panel/80 px-2 py-1.5 shadow-xl"

                onPointerDown={stop}

                onPointerMove={stop}

                onPointerUp={stop}

                onPointerCancel={stop}

                onWheel={stop}

                onMouseDown={stop}

              >

                <button type="button" className="ws-icon-btn" onClick={props.onFit} title="Fit">

                  <Maximize2 className="h-4 w-4" />

                </button>

                <button type="button" className="ws-icon-btn" onClick={props.onZoomOut} title="Zoom out">

                  <Minus className="h-4 w-4" />

                </button>

                <div className="px-1 text-[11px] text-muted tabular-nums min-w-[56px] text-center">{props.zoomLabel}</div>

                <button type="button" className="ws-icon-btn" onClick={props.onZoomIn} title="Zoom in">

                  <Plus className="h-4 w-4" />

                </button>

                <button type="button" className="ws-icon-btn" onClick={props.onReset} title="Reset">

                  <RotateCw className="h-4 w-4" />

                </button>



                <div className="mx-1 h-5 w-px bg-border/70" />



                <button type="button" className="ws-btn" onClick={props.onOpenAsText}>

                  Open as Text

                </button>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}



function MenuPortal(props: {

  anchor: DOMRect;

  approxWidth: number;

  approxHeight?: number;

  preferLeft?: boolean;

  children: React.ReactNode;

}) {

  const pos = computeSubmenuPos(props.anchor, props.approxWidth, { preferLeft: props.preferLeft, approxHeight: props.approxHeight });

  return createPortal(

    <div style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 100000 }}>

      {props.children}

    </div>,

    document.body,

  );

}



function computeSubmenuPos(anchor: DOMRect, approxWidth: number, opts?: { preferLeft?: boolean; approxHeight?: number }) {

  const pad = 8;

  const approxHeight = Math.max(120, Math.floor(opts?.approxHeight ?? 360));



  const rightX = anchor.right;

  const leftX = anchor.left - approxWidth;

  const canOpenRight = rightX + approxWidth <= window.innerWidth - pad;

  const canOpenLeft = leftX >= pad;

  const preferLeft = !!opts?.preferLeft;



  const openRight = preferLeft ? !canOpenLeft : canOpenRight;

  const desiredX = openRight ? rightX : leftX;

  const x = clamp(desiredX, pad, Math.max(pad, window.innerWidth - approxWidth - pad));



  const belowY = anchor.bottom + 6;

  const aboveY = anchor.top - approxHeight - 6;

  const canOpenBelow = belowY + approxHeight <= window.innerHeight - pad;

  const desiredY = canOpenBelow ? belowY : aboveY;

  const y = clamp(desiredY, pad, Math.max(pad, window.innerHeight - approxHeight - pad));



  return { x, y };

}



function computeContextMenuPos(anchor: { x: number; y: number }, size: { w: number; h: number }) {

  const pad = 8;

  const maxX = Math.max(pad, window.innerWidth - size.w - pad);

  const maxY = Math.max(pad, window.innerHeight - size.h - pad);

  return {

    x: clamp(anchor.x, pad, maxX),

    y: clamp(anchor.y, pad, maxY),

  };

}



function useTypewriterText(text: string, opts?: { enabled?: boolean; cps?: number; maxChars?: number }): string {

  const enabled = opts?.enabled !== false;

  const cps = Math.max(10, Math.min(240, Math.floor(opts?.cps ?? 70)));

  const maxChars = Math.max(200, Math.min(12000, Math.floor(opts?.maxChars ?? 6000)));

  const safe = String(text ?? "").slice(0, maxChars);

  const [n, setN] = useState<number>(enabled ? 0 : safe.length);

  const prevTextRef = useRef<string>(safe);



  useEffect(() => {

    if (!enabled) {

      setN(safe.length);

      prevTextRef.current = safe;

      return;

    }



    setN((prev) => {

      const prevText = prevTextRef.current;

      if (safe.startsWith(prevText) && prev <= prevText.length) return prev;

      return 0;

    });

    if (!safe.length) return;



    const stepMs = Math.max(12, Math.floor(1000 / cps));

    let alive = true;

    const timer = window.setInterval(() => {

      if (!alive) return;

      setN((prev) => {

        if (prev >= safe.length) return prev;

        return Math.min(safe.length, prev + 1);

      });

    }, stepMs);

    return () => {

      alive = false;

      window.clearInterval(timer);

    };

  }, [safe, enabled, cps]);



  useEffect(() => {

    prevTextRef.current = safe;

  }, [safe]);



  return safe.slice(0, n);

}



function FileEditPill(props: { file: string; added: number; removed: number; onClick?: () => void }) {

  return (

    <button

      type="button"

      className="ws-step-pill hover:bg-bg hover:text-text transition-colors"

      onClick={props.onClick}

      title={props.file}

    >

      {(() => {

        const Icon = fileIconFor(props.file);

        return <Icon className="h-4 w-4" />;

      })()}

      <span className="max-w-[44ch] truncate">{props.file}</span>

      <span className="ml-1 text-emerald-300">+{props.added}</span>

      <span className="ml-1 text-red-300">-{props.removed}</span>

    </button>

  );

}



function EventStreamMessageBubble(props: { eventId: string; content: string; showCaret?: boolean }) {

  const typed = useTypewriterText(props.content || "", { enabled: true, cps: 90 });

  return (

    <div key={props.eventId} className="ws-msg ws-msg-anim ws-msg-assistant whitespace-pre-wrap break-words">

      {typed}

      {props.showCaret ? <span className="ws-caret" /> : null}

    </div>

  );

}



function EventStreamStateLine(props: { eventId: string; content: string }) {

  return (

    <div key={props.eventId} className="px-1 text-[11px] text-muted whitespace-pre-wrap break-words">

      {props.content}

    </div>

  );

}



function EventStreamCard(props: {

  es: NonNullable<ChatUiMessage["eventStream"]>;

  onOpenFileDiff?: (path: string) => void;

}) {

  const visible = (props.es.events ?? []).filter((e) => {

    if (e.type === "state" && e.hidden) return false;

    if (e.type === "state" && String(e.content || "").trim().toLowerCase() === "analyzing…") return false;

    if (e.type === "state" && String(e.content || "").trim().toLowerCase() === "analyzing...") return false;

    return true;

  });



  const hasAnyMessage = visible.some((e) => e.type === "message" && String((e as any).content || "").trim().length > 0);



  return (

    <div className="space-y-2">

      {visible.map((e) => {

        if (e.type === "message") {

          const isRunningLast = props.es.status === "running" && e.id === visible[visible.length - 1]?.id;

          return (

            <EventStreamMessageBubble key={e.id} eventId={e.id} content={e.content || ""} showCaret={isRunningLast} />

          );

        }

        if (e.type === "state") {

          return <EventStreamStateLine key={e.id} eventId={e.id} content={e.content || ""} />;

        }

        return (

          <div key={e.id}>

            <FileEditPill file={e.file} added={e.added} removed={e.removed} onClick={() => props.onOpenFileDiff?.(e.file)} />

          </div>

        );

      })}



      {props.es.status === "running" && !hasAnyMessage ? (

        <div className="ws-msg ws-msg-anim ws-msg-assistant inline-flex items-center px-3 py-2">

          <span className="ws-presence-dots" aria-label="Thinking">

            <span />

            <span />

            <span />

          </span>

        </div>

      ) : null}

    </div>

  );

}



function normalizeAiEventInputs(eventsRaw: unknown): AiEventInput[] {

  if (!Array.isArray(eventsRaw)) return [];

  const out: AiEventInput[] = [];

  for (const e of eventsRaw) {

    if (!e || typeof e !== "object") continue;

    const obj = e as Record<string, unknown>;

    const type = typeof obj.type === "string" ? obj.type : "";

    if (type === "message") {

      const content = typeof obj.content === "string" ? obj.content.trim() : "";

      if (content) out.push({ type: "message", content });

      continue;

    }

    if (type === "state") {

      const content = typeof obj.content === "string" ? obj.content.trim() : "";

      if (!content) continue;

      const hidden = typeof obj.hidden === "boolean" ? obj.hidden : undefined;

      const ttlMs = typeof obj.ttlMs === "number" && Number.isFinite(obj.ttlMs) ? obj.ttlMs : undefined;

      out.push({ type: "state", content, hidden, ttlMs });

      continue;

    }

    if (type === "file_edit") {

      const file = typeof obj.file === "string" ? obj.file.trim() : "";

      if (!file) continue;

      const added = typeof obj.added === "number" && Number.isFinite(obj.added) ? Math.max(0, Math.floor(obj.added)) : 0;

      const removed = typeof obj.removed === "number" && Number.isFinite(obj.removed) ? Math.max(0, Math.floor(obj.removed)) : 0;

      out.push({ type: "file_edit", file, added, removed });

      continue;

    }

  }

  return out.slice(0, 80);

}



function toChatEvents(inputs: AiEventInput[], baseTs?: number): ChatEvent[] {

  const now = typeof baseTs === "number" ? baseTs : Date.now();

  return inputs.map((x, i) => {

    const id = `ev-${now}-${i}-${Math.random().toString(16).slice(2)}`;

    const ts = now + i;

    if (x.type === "message") return { id, ts, type: "message", content: x.content };

    if (x.type === "state") return { id, ts, type: "state", content: x.content, hidden: x.hidden, ttlMs: x.ttlMs };

    return { id, ts, type: "file_edit", file: x.file, added: x.added, removed: x.removed };

  });

}



 function migrateStoredChatMessage(raw: any): ChatUiMessage | null {

  if (!raw || typeof raw !== "object") return null;



  if (raw.kind === "proposal") return null;



  const role: ChatUiMessage["role"] = raw.role === "user" || raw.role === "assistant" || raw.role === "meta" ? raw.role : "assistant";

  const base: ChatUiMessage = {

    role,

    content: typeof raw.content === "string" ? raw.content : "",

    id: typeof raw.id === "string" ? raw.id : undefined,

    rating: raw.rating === "up" || raw.rating === "down" || raw.rating === null ? raw.rating : undefined,

    kind: raw.kind === "run_request" || raw.kind === "activity" || raw.kind === "event_stream" ? raw.kind : undefined,

    run: raw.run && typeof raw.run === "object" ? raw.run : undefined,

    activity: raw.activity && typeof raw.activity === "object" ? raw.activity : undefined,

    eventStream: raw.eventStream && typeof raw.eventStream === "object" ? raw.eventStream : undefined,

  };



  const maybeAgentRun = raw.agentRun ?? raw.agent_run;

  const isLegacyAgentRun = raw.kind === "agent_run" || Boolean(maybeAgentRun);

  if (isLegacyAgentRun) {

    const ar = (maybeAgentRun && typeof maybeAgentRun === "object" ? maybeAgentRun : {}) as any;

    const legacyText = [ar.think, ar.plan, ar.act, ar.output, ar.verify, ar.done]

      .filter((x: any) => typeof x === "string")

      .map((s: string) => s.trim())

      .filter(Boolean)

      .join("\n\n");



    const status: NonNullable<NonNullable<ChatUiMessage["eventStream"]>["status"]> =

      ar.status === "running" ? "running" : ar.status === "error" ? "error" : "done";

    const content = legacyText || base.content || "Ready.";

    return {

      ...base,

      kind: "event_stream",

      eventStream: {

        status,

        events: toChatEvents([{ type: "message", content }]),

      },

    };

  }



  if (base.kind === "event_stream" && base.eventStream && Array.isArray((base.eventStream as any).events)) {

    const es = base.eventStream as any;

    const status: "running" | "done" | "error" = es.status === "running" || es.status === "error" ? es.status : "done";

    const rawEvents = es.events as any[];



    const looksLikeChatEvents = rawEvents.every(

      (e) => e && typeof e === "object" && typeof e.id === "string" && typeof e.ts === "number" && typeof e.type === "string"

    );

    const events: ChatEvent[] = looksLikeChatEvents

      ? (rawEvents as ChatEvent[])

      : toChatEvents(normalizeAiEventInputs(rawEvents));



    return {

      ...base,

      kind: "event_stream",

      eventStream: { status, events },

    };

  }



  return base;

}



function clamp(n: number, min: number, max: number): number {

  return Math.max(min, Math.min(max, n));

}



function formatRelTime(ts: number): string {

  const d = Math.max(0, Date.now() - ts);

  const s = Math.floor(d / 1000);

  if (s < 60) return "now";

  const m = Math.floor(s / 60);

  if (m < 60) return `${m}m`;

  const h = Math.floor(m / 60);

  if (h < 24) return `${h}h`;

  const days = Math.floor(h / 24);

  if (days < 7) return `${days}d`;

  const w = Math.floor(days / 7);

  if (w < 4) return `${w}w`;

  const mo = Math.floor(days / 30);

  if (mo < 12) return `${mo}mo`;

  const y = Math.floor(days / 365);

  return `${y}y`;

}



function deriveChatTitleFromPrompt(prompt: string): string {

  const line = prompt.split("\n")[0]?.trim() ?? "";

  const cleaned = line.replace(/\s+/g, " ").replace(/[\[\]{}<>`]/g, "").trim();

  if (!cleaned) return "Chat";

  return cleaned.length > 34 ? `${cleaned.slice(0, 34).trim()}…` : cleaned;

}



type ChangeFile = {

  kind: "write" | "delete" | "rename";

  path: string;

  before: string | null;

  after: string | null;

};



type ChangeSet = {

  id: string;

  edits: AiEditOp[];

  files: ChangeFile[];

  stats: { files: number; added: number; removed: number };

  applied: boolean;

};



function isUserOrAssistantMessage(m: ChatUiMessage): m is ChatUiMessage & { role: "user" | "assistant" } {

  return m.role === "user" || m.role === "assistant";

}



function looksLikeCodeDump(s: string): boolean {

  const t = s.trim();

  if (!t) return false;

  // Heuristics: big blocks, common code markers.

  if (t.length > 800) return true;

  if (t.includes("<!DOCTYPE html") || t.includes("<html") || t.includes("</div>") || t.includes("function ")) return true;

  if (t.includes("```")) return true;

  if (t.startsWith("{") && t.includes("\"edits\"")) return true;

  return false;

}



function extractFileRefs(text: string): string[] {

  const out: string[] = [];

  const re = /(^|[\s"'`(\[])([A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,8})(?=$|[\s"'`),.:;!?\]])/g;

  const seen = new Set<string>();

  let m: RegExpExecArray | null;

  while ((m = re.exec(text))) {

    const raw = (m[2] ?? "").trim();

    if (!raw) continue;

    if (raw.includes("://")) continue;

    const p = raw.replace(/^\.\//, "");

    if (!p.includes(".")) continue;

    if (p.length > 140) continue;

    if (seen.has(p)) continue;

    seen.add(p);

    out.push(p);

  }

  return out;

}



function buildFileTreePreview(paths: string[], maxLines = 420, maxDepth = 7): string {

  const root: { dirs: Map<string, any>; files: string[] } = { dirs: new Map(), files: [] };



  for (const p0 of paths) {

    const p = String(p0 || "").trim().replace(/^\.\//, "");

    if (!p) continue;

    const segs = p.split("/").filter(Boolean);

    if (!segs.length) continue;

    let node = root;

    const depth = Math.min(segs.length, maxDepth);

    for (let i = 0; i < depth - 1; i++) {

      const name = segs[i]!;

      let next = node.dirs.get(name);

      if (!next) {

        next = { dirs: new Map<string, any>(), files: [] as string[] };

        node.dirs.set(name, next);

      }

      node = next;

    }

    const leaf = segs[Math.min(segs.length, maxDepth) - 1]!;

    if (segs.length > maxDepth) {

      let next = node.dirs.get(leaf);

      if (!next) {

        next = { dirs: new Map<string, any>(), files: [] as string[] };

        node.dirs.set(leaf, next);

      }

    } else {

      node.files.push(leaf);

    }

  }



  const out: string[] = [];

  const render = (node: { dirs: Map<string, any>; files: string[] }, prefix: string, level: number) => {

    if (out.length >= maxLines) return;



    const dirs = Array.from(node.dirs.keys()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    const files = node.files.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));



    for (const d of dirs) {

      if (out.length >= maxLines) return;

      out.push(`${prefix}${d}/`);

      const child = node.dirs.get(d);

      if (child && level + 1 < maxDepth) {

        render(child, `${prefix}  `, level + 1);

      }

    }



    for (const f of files) {

      if (out.length >= maxLines) return;

      out.push(`${prefix}${f}`);

    }

  };



  render(root, "", 0);

  if (paths.length && out.length >= maxLines) out.push("… (truncated)");

  return out.join("\n");

}



function pickDefaultContextFiles(paths: string[], activePath?: string | null): string[] {

  const set = new Set<string>();

  const norm = (p: string) => String(p || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");

  const add = (p: string) => {

    const k = norm(p);

    if (!k) return;

    if (!paths.includes(k)) return;

    set.add(k);

  };



  if (activePath) add(activePath);



  const preferred = [

    "README.md",

    "readme.md",

    "package.json",

    "package-lock.json",

    "pnpm-lock.yaml",

    "yarn.lock",

    "tsconfig.json",

    "vite.config.ts",

    "next.config.ts",

    "next.config.js",

    "index.html",

    "src/main.tsx",

    "src/main.ts",

    "src/App.tsx",

    "src/AppShell.tsx",

    "src-tauri/Cargo.toml",

    "Cargo.toml",

  ];

  for (const p of preferred) add(p);



  return Array.from(set).slice(0, 10);

}



function isLikelyDangerousCommand(cmd: string): boolean {

  const c = cmd.trim().toLowerCase();

  if (!c) return false;

  if (/\brm\b/.test(c) && /\s-\w*r\w*f\b/.test(c)) return true;

  if (/\bmkfs\b/.test(c)) return true;

  if (/\bdd\b/.test(c) && /\bif=\b/.test(c)) return true;

  if (/\bshutdown\b|\breboot\b|\bpoweroff\b/.test(c)) return true;

  if (c.includes(":(){") && c.includes("};:")) return true;

  return false;

}



function splitLines(s: string): string[] {

  // Keep trailing empty line behavior stable.

  return s.replace(/\r\n/g, "\n").split("\n");

}



function stripAnsiForLog(s: string): string {

  return s

    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")

    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")

    .replace(/\r/g, "");

}



type UnifiedDiffHunkLine = { kind: "ctx" | "add" | "del"; text: string };

type UnifiedDiffHunk = {

  oldStart: number;

  oldCount: number;

  newStart: number;

  newCount: number;

  lines: UnifiedDiffHunkLine[];

};



function parseUnifiedDiff(patchText: string): UnifiedDiffHunk[] {

  const lines = splitLines(patchText);

  const hunks: UnifiedDiffHunk[] = [];

  let i = 0;



  const parseRange = (s: string): { start: number; count: number } => {

    const m = s.match(/^(\d+)(?:,(\d+))?$/);

    if (!m) return { start: 0, count: 0 };

    return { start: Number(m[1]), count: m[2] ? Number(m[2]) : 1 };

  };



  while (i < lines.length) {

    const line = lines[i]!;

    const m = line.match(/^@@\s+-(\d+(?:,\d+)?)\s+\+(\d+(?:,\d+)?)\s+@@/);

    if (!m) {

      i++;

      continue;

    }



    const oldR = parseRange(m[1]!);

    const newR = parseRange(m[2]!);

    const hunk: UnifiedDiffHunk = {

      oldStart: oldR.start,

      oldCount: oldR.count,

      newStart: newR.start,

      newCount: newR.count,

      lines: [],

    };

    i++;



    while (i < lines.length) {

      const l = lines[i]!;

      if (l.startsWith("@@ ")) break;

      if (l.startsWith("--- ") || l.startsWith("+++ ") || l.startsWith("diff ")) {

        i++;

        continue;

      }



      const prefix = l[0];

      const text = l.slice(1);

      if (prefix === " ") hunk.lines.push({ kind: "ctx", text });

      else if (prefix === "+") hunk.lines.push({ kind: "add", text });

      else if (prefix === "-") hunk.lines.push({ kind: "del", text });

      else if (l === "\\ No newline at end of file") {

        // ignore

      } else {

        // treat unknown as context to be conservative

        hunk.lines.push({ kind: "ctx", text: l });

      }

      i++;

    }



    hunks.push(hunk);

  }



  return hunks;

}



function findSequenceStart(hay: string[], seq: string[], minIndex: number, preferredIndex: number): number | null {

  if (!seq.length) return Math.max(minIndex, Math.min(preferredIndex, hay.length));

  const maxStart = hay.length - seq.length;

  if (minIndex > maxStart) return null;

  let best: number | null = null;

  let bestDist = Infinity;

  for (let i = minIndex; i <= maxStart; i++) {

    let ok = true;

    for (let j = 0; j < seq.length; j++) {

      if (hay[i + j] !== seq[j]) {

        ok = false;

        break;

      }

    }

    if (!ok) continue;

    const dist = Math.abs(i - preferredIndex);

    if (dist < bestDist) {

      bestDist = dist;

      best = i;

      if (dist === 0) break;

    }

  }

  return best;

}



function applyUnifiedDiffToText(before: string, patchText: string): { ok: true; text: string } | { ok: false; error: string } {

  const hunks = parseUnifiedDiff(patchText);

  if (!hunks.length) return { ok: false, error: "Patch has no hunks" };



  const a = splitLines(before);

  const out: string[] = [];

  let ai = 0;



  for (const h of hunks) {

    const preferredIdx = Math.max(0, h.oldStart - 1);



    const oldSeq = h.lines

      .filter((x) => x.kind === "ctx" || x.kind === "del")

      .map((x) => x.text);



    const foundIdx = findSequenceStart(a, oldSeq, ai, preferredIdx);

    if (foundIdx === null) {

      return { ok: false, error: `Failed to locate hunk context in file (starting near line ${preferredIdx + 1}).` };

    }



    if (foundIdx < ai) return { ok: false, error: "Patch hunk overlaps previous hunk" };

    out.push(...a.slice(ai, foundIdx));

    ai = foundIdx;



    for (const hl of h.lines) {

      if (hl.kind === "ctx") {

        if (a[ai] !== hl.text) {

          return {

            ok: false,

            error: `Context mismatch at line ${ai + 1}: expected '${hl.text}', got '${a[ai] ?? "<eof>"}'`,

          };

        }

        out.push(a[ai]!);

        ai++;

      } else if (hl.kind === "del") {

        if (a[ai] !== hl.text) {

          return {

            ok: false,

            error: `Delete mismatch at line ${ai + 1}: expected '${hl.text}', got '${a[ai] ?? "<eof>"}'`,

          };

        }

        ai++;

      } else if (hl.kind === "add") {

        out.push(hl.text);

      }

    }

  }



  out.push(...a.slice(ai));

  return { ok: true, text: out.join("\n") };

}



function normalizeGitPath(p: string): string {

  const t = p.trim();

  if (t === "/dev/null") return t;

  if (t.startsWith("a/")) return t.slice(2);

  if (t.startsWith("b/")) return t.slice(2);

  return t;

}



function splitMultiFileGitDiffToEdits(diffText: string): AiEditOp[] {

  const lines = splitLines(diffText);

  const blocks: string[][] = [];

  let cur: string[] = [];



  for (const l of lines) {

    if (l.startsWith("diff --git ")) {

      if (cur.length) blocks.push(cur);

      cur = [l];

      continue;

    }

    if (!cur.length) continue;

    cur.push(l);

  }

  if (cur.length) blocks.push(cur);



  const edits: AiEditOp[] = [];



  for (const b of blocks) {

    const blockText = b.join("\n");

    let renameFrom: string | null = null;

    let renameTo: string | null = null;

    let oldPath: string | null = null;

    let newPath: string | null = null;



    for (const l of b) {

      if (l.startsWith("rename from ")) renameFrom = normalizeGitPath(l.slice("rename from ".length));

      if (l.startsWith("rename to ")) renameTo = normalizeGitPath(l.slice("rename to ".length));

      if (l.startsWith("--- ")) oldPath = normalizeGitPath(l.slice(4));

      if (l.startsWith("+++ ")) newPath = normalizeGitPath(l.slice(4));

    }



    const isDelete = newPath === "/dev/null" || b.some((x) => x.startsWith("deleted file mode"));

    const isNew = oldPath === "/dev/null" || b.some((x) => x.startsWith("new file mode"));



    if (renameFrom && renameTo) {

      edits.push({ op: "rename", from: renameFrom, to: renameTo });

      // If there are hunks, apply them after the rename.

      if (blockText.includes("@@ ")) {

        edits.push({ op: "patch", path: renameTo, content: blockText });

      }

      continue;

    }



    const path = (newPath && newPath !== "/dev/null" ? newPath : oldPath && oldPath !== "/dev/null" ? oldPath : null) ?? null;

    if (!path) continue;



    if (isDelete) {

      edits.push({ op: "delete", path });

      continue;

    }



    // new/modified file

    if (blockText.includes("@@ ")) {

      edits.push({ op: "patch", path, content: blockText });

    } else if (isNew) {

      // git diff for new empty file can have no hunks; treat as create empty

      edits.push({ op: "write", path, content: "" });

    }

  }



  return edits;

}



function normalizeAiEdits(edits: AiEditOp[], workspaceRoot?: string | null): { edits: AiEditOp[]; didSanitize: boolean } {

  const sanitizePath = (raw: string, workspaceRoot?: string | null): string => {

    let p = String(raw ?? "").trim();

    if (!p) return p;



    p = p.replace(/\\/g, "/");

    while (p.startsWith("./")) p = p.slice(2);



    const root = (workspaceRoot ?? "").replace(/\\/g, "/").replace(/\/$/, "");

    if (root && (p === root || p.startsWith(root + "/"))) {

      p = p.slice(root.length);

      if (p.startsWith("/")) p = p.slice(1);

    }



    // If the path is still absolute or contains traversal, collapse it to a safe filename.

    const looksAbsolute = p.startsWith("/") || /^[A-Za-z]:\//.test(p);

    if (looksAbsolute || p.includes("..")) {

      p = basename(p);

    }



    if (p.startsWith("/")) p = p.slice(1);

    return p;

  };



  let didSanitize = false;



  const sanitizeOne = (e: AiEditOp): AiEditOp => {

    const op = (e.op || "").toLowerCase();

    if (op === "rename") {

      const fromRaw = typeof e.from === "string" ? e.from : "";

      const toRaw = typeof e.to === "string" ? e.to : "";

      const from = typeof e.from === "string" ? sanitizePath(e.from, workspaceRoot) : e.from;

      const to = typeof e.to === "string" ? sanitizePath(e.to, workspaceRoot) : e.to;

      if (fromRaw && from && fromRaw !== from) didSanitize = true;

      if (toRaw && to && toRaw !== to) didSanitize = true;

      return { ...e, from, to };

    }



    if (typeof e.path === "string") {

      const raw = e.path;

      const path = sanitizePath(raw, workspaceRoot);

      if (raw !== path) didSanitize = true;

      return { ...e, path };

    }



    return e;

  };



  const out: AiEditOp[] = [];

  for (const e of edits) {

    const op = (e.op || "").toLowerCase();

    if (op === "patch") {

      const patchText = String(e.content ?? "");

      const hasGitDiff = patchText.includes("diff --git ") && patchText.includes("@@ ");

      const missingPath = !e.path || !String(e.path).trim();

      if (missingPath && hasGitDiff) {

        for (const x of splitMultiFileGitDiffToEdits(patchText)) out.push(sanitizeOne(x));

        continue;

      }

      // If user/AI provides a path but the patch is multi-file, split anyway.

      if (hasGitDiff && patchText.includes("\ndiff --git ")) {

        for (const x of splitMultiFileGitDiffToEdits(patchText)) out.push(sanitizeOne(x));

        continue;

      }

    }

    out.push(sanitizeOne(e));

  }

  return { edits: out, didSanitize };

}



type LineOp = { type: "ctx" | "add" | "del"; line: string };



// Minimal Myers diff for line arrays.

function diffLines(before: string, after: string): LineOp[] {

  const a = splitLines(before);

  const b = splitLines(after);

  const n = a.length;

  const m = b.length;

  const max = n + m;

  const v = new Map<number, number>();

  v.set(1, 0);

  const trace: Map<number, number>[] = [];



  for (let d = 0; d <= max; d++) {

    const v2 = new Map<number, number>();

    for (let k = -d; k <= d; k += 2) {

      let x: number;

      if (k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {

        x = v.get(k + 1) ?? 0;

      } else {

        x = (v.get(k - 1) ?? 0) + 1;

      }

      let y = x - k;

      while (x < n && y < m && a[x] === b[y]) {

        x++;

        y++;

      }

      v2.set(k, x);

      if (x >= n && y >= m) {

        trace.push(v2);

        // backtrack

        const ops: LineOp[] = [];

        let x2 = n;

        let y2 = m;

        for (let d2 = trace.length - 1; d2 >= 0; d2--) {

          const vv = trace[d2]!;

          const k2 = x2 - y2;

          let prevK: number;

          if (k2 === -(d2) || (k2 !== d2 && (vv.get(k2 - 1) ?? 0) < (vv.get(k2 + 1) ?? 0))) {

            prevK = k2 + 1;

          } else {

            prevK = k2 - 1;

          }

          const prevX = vv.get(prevK) ?? 0;

          const prevY = prevX - prevK;



          while (x2 > prevX && y2 > prevY) {

            ops.push({ type: "ctx", line: a[x2 - 1]! });

            x2--;

            y2--;

          }



          if (d2 === 0) break;



          if (x2 === prevX) {

            // insertion

            ops.push({ type: "add", line: b[y2 - 1]! });

            y2--;

          } else {

            // deletion

            ops.push({ type: "del", line: a[x2 - 1]! });

            x2--;

          }

        }



        ops.reverse();

        return ops;

      }

    }

    trace.push(v2);

    v.clear();

    for (const [k, val] of v2.entries()) v.set(k, val);

  }



  return [];

}



function computeStats(files: ChangeFile[]): { files: number; added: number; removed: number } {

  let added = 0;

  let removed = 0;

  for (const f of files) {

    const before = f.before ?? "";

    const after = f.after ?? "";

    const ops = diffLines(before, after);

    for (const op of ops) {

      if (op.type === "add") added++;

      if (op.type === "del") removed++;

    }

  }

  return { files: files.length, added, removed };

}



function computeFileEditStats(f: ChangeFile): { added: number; removed: number } {

  const before = f.before ?? "";

  const after = f.after ?? "";

  const ops = diffLines(before, after);

  let added = 0;

  let removed = 0;

  for (const op of ops) {

    if (op.type === "add") added++;

    if (op.type === "del") removed++;

  }

  return { added, removed };

}



function tryParseEditsFromAssistantOutput(

  raw: string

): { message: string; edits: AiEditOp[]; events?: ChatEvent[] } | null {

  const t = raw.trim();

  if (!t) return null;



  const tryParse = (s: string) => {

    try {

      return JSON.parse(s) as unknown;

    } catch {

      return null;

    }

  };



  const direct = tryParse(t);

  const parsed = direct ?? (() => {

    // Extract first JSON object substring (handles braces inside strings).

    let depth = 0;

    let start = -1;

    let inStr = false;

    let escape = false;

    for (let i = 0; i < t.length; i++) {

      const ch = t[i]!;

      if (inStr) {

        if (escape) {

          escape = false;

          continue;

        }

        if (ch === "\\") {

          escape = true;

          continue;

        }

        if (ch === '"') inStr = false;

        continue;

      }

      if (ch === '"') {

        inStr = true;

        continue;

      }

      if (ch === "{") {

        if (depth === 0) start = i;

        depth++;

        continue;

      }

      if (ch === "}") {

        depth--;

        if (depth === 0 && start >= 0) {

          return tryParse(t.slice(start, i + 1));

        }

      }

    }

    return null;

  })();



  const extractEditsArray = (text: string): AiEditOp[] | null => {

    const idx = text.indexOf('"edits"');

    if (idx < 0) return null;

    const after = text.slice(idx);

    const arrStart = after.indexOf('[');

    if (arrStart < 0) return null;



    const s = after.slice(arrStart);

    let depth = 0;

    let inStr = false;

    let escape = false;

    for (let i = 0; i < s.length; i++) {

      const ch = s[i]!;

      if (inStr) {

        if (escape) {

          escape = false;

          continue;

        }

        if (ch === "\\") {

          escape = true;

          continue;

        }

        if (ch === '"') inStr = false;

        continue;

      }

      if (ch === '"') {

        inStr = true;

        continue;

      }

      if (ch === '[') {

        depth++;

        continue;

      }

      if (ch === ']') {

        depth--;

        if (depth === 0) {

          const arrText = s.slice(0, i + 1);

          const parsedArr = tryParse(arrText);

          if (Array.isArray(parsedArr)) return parsedArr as AiEditOp[];

          return null;

        }

      }

    }

    return null;

  };



  if (parsed && typeof parsed === "object") {

    const obj = parsed as {

      edits?: unknown;

      assistant_message?: unknown;

      summary?: unknown;

      think?: unknown;

      plan?: unknown;

      verify?: unknown;

      done?: unknown;

      events?: unknown;

    };

    if (Array.isArray(obj.edits)) {

      const edits = obj.edits as AiEditOp[];

      const msg =

        (typeof obj.assistant_message === "string" ? obj.assistant_message : null) ??

        (typeof obj.summary === "string" ? obj.summary : null) ??

        "Proposed changes are ready.";



      const baseTs = Date.now();

      const normalizedInputs = normalizeAiEventInputs(obj.events);

      const events = normalizedInputs.length

        ? toChatEvents(normalizedInputs, baseTs)

        : toChatEvents([{ type: "message", content: String(msg).trim() }], baseTs);



      return { message: String(msg).trim(), edits, events };

    }

  }



  // If the full JSON object is malformed/truncated, try extracting just the edits array.

  const fallbackEdits = extractEditsArray(t);

  if (fallbackEdits && fallbackEdits.length) {

    return {

      message: "Proposed changes are ready.",

      edits: fallbackEdits,

      events: toChatEvents([{ type: "message", content: "Proposed changes are ready." }]),

    };

  }



  return null;

}



function MenuSep() {

  return <div className="my-1 h-px bg-transparent" />;

}



function MenuCheck(props: { checked?: boolean }) {

  return props.checked ? <span className="text-[11px] text-muted">✓</span> : null;

}



function MenuItem(props: {

  label: string;

  left?: React.ReactNode;

  shortcut?: string;

  right?: React.ReactNode;

  keepOpen?: boolean;

  onClick?: () => void;

  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;

  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;

}) {

  return (

    <button

      type="button"

      className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-text hover:bg-bg"

      onClick={() => {

        props.onClick?.();

        if (!props.keepOpen) {

          window.dispatchEvent(new Event("pompora:menubar-close"));

        }

      }}

      onMouseEnter={props.onMouseEnter}

      onMouseLeave={props.onMouseLeave}

    >

      <span className="flex min-w-0 items-center gap-2">

        {props.left ? <span className="shrink-0 text-muted">{props.left}</span> : null}

        <span className="truncate">{props.label}</span>

      </span>

      <span className="flex items-center gap-2 text-[11px] text-muted">

        {props.shortcut ? <span className="whitespace-nowrap">{props.shortcut}</span> : null}

        {props.right ?? null}

      </span>

    </button>

  );

}



function basename(p: string) {

  const norm = p.replace(/\\/g, "/");

  const parts = norm.split("/").filter(Boolean);

  return parts[parts.length - 1] ?? p;

}



function dirname(p: string) {

  const norm = p.replace(/\\/g, "/");

  const idx = norm.lastIndexOf("/");

  if (idx <= 0) return "/";

  return norm.slice(0, idx);

}



 function normalizeRelPath(p: string) {

   let norm = String(p || "").trim();

   if (!norm) return "";

   norm = norm.replace(/\\/g, "/");

   while (norm.startsWith("./")) norm = norm.slice(2);

   norm = norm.replace(/^\/+/, "");

   norm = norm.replace(/\/+?/g, "/");

   return norm;

 }



function detectLanguage(path: string): string {

  const lower = path.toLowerCase();

  const ext = lower.includes(".") ? lower.split(".").pop() ?? "" : "";

  if (ext === "ts") return "typescript";

  if (ext === "tsx") return "typescript";

  if (ext === "js") return "javascript";

  if (ext === "jsx") return "javascript";

  if (ext === "json") return "json";

  if (ext === "css") return "css";

  if (ext === "scss" || ext === "sass" || ext === "less") return "css";

  if (ext === "html") return "html";

  if (ext === "md") return "markdown";

  if (ext === "mdx") return "markdown";

  if (ext === "rs") return "rust";

  if (ext === "toml") return "toml";

  if (ext === "yaml" || ext === "yml") return "yaml";

  return "plaintext";

}



function isImagePath(path: string): boolean {

  const lower = String(path || "")

    .trim()

    .replace(/\\/g, "/")

    .toLowerCase();

  const name = basename(lower);

  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";

  return (

    ext === "png" ||

    ext === "jpg" ||

    ext === "jpeg" ||

    ext === "gif" ||

    ext === "webp" ||

    ext === "bmp" ||

    ext === "ico" ||

    ext === "tiff" ||

    ext === "tif" ||

    ext === "svg" ||

    ext === "avif" ||

    ext === "heic" ||

    ext === "heif"

  );

}



function base64ToObjectUrl(mime: string, base64: string): string {

  const bin = atob(base64);

  const bytes = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const blob = new Blob([bytes], { type: mime || "application/octet-stream" });

  return URL.createObjectURL(blob);

}



function revokeTabObjectUrl(tab: EditorTab | null | undefined) {

  if (!tab) return;

  if (tab.kind !== "image") return;

  const url = tab.image?.url;

  if (!url || !url.startsWith("blob:")) return;

  try {

    URL.revokeObjectURL(url);

  } catch {

  }

}



type __FileIcon = (props: { className?: string }) => ReactElement;



const __extIconCache = new Map<string, __FileIcon>();



function __stableHue(s: string): number {

  let h = 0;

  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;

  return h % 360;

}



function __stableHash(s: string): number {

  let h = 2166136261;

  for (let i = 0; i < s.length; i++) {

    h ^= s.charCodeAt(i);

    h = Math.imul(h, 16777619);

  }

  return h >>> 0;

}



function __makeIconifyTile(opts: { icon: any; bg: string; fg: string }) {

  const bg = opts.bg;

  const fg = opts.fg;

  const icon = opts.icon;

  return function IconifyTile(props: { className?: string }) {

    const className = props.className ?? "";

    return (

      <span className={`${className} inline-flex items-center justify-center rounded-[6px]`} style={{ backgroundColor: bg }} aria-hidden>

        <IconifyIcon icon={icon} className="h-[72%] w-[72%]" style={{ color: fg }} />

      </span>

    );

  };


}



function __makePatternTile(opts: { bg: string; seed: string; fg?: string }) {

  const bg = opts.bg;

  const fg = opts.fg ?? "rgba(255,255,255,0.92)";

  const v = __stableHash(opts.seed) % 4;

  return function PatternTile(props: { className?: string }) {

    const className = props.className ?? "";

    return (

      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable={false} shapeRendering="geometricPrecision">

        <rect x="0" y="0" width="24" height="24" rx="6" fill={bg} />

        {v === 0 ? <path d="M4 18 18 4" stroke={fg} strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" /> : null}

        {v === 1 ? (

          <g fill={fg} fillOpacity="0.12">

            <circle cx="7" cy="7" r="1.2" />

            <circle cx="17" cy="7" r="1.2" />

            <circle cx="7" cy="17" r="1.2" />

            <circle cx="17" cy="17" r="1.2" />

          </g>

        ) : null}

        {v === 2 ? <path d="M4.2 8.2h15.6" stroke={fg} strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" /> : null}

        {v === 3 ? <path d="M8 20 20 8" stroke={fg} strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" /> : null}

        <path

          d="M8 6.7h7l2.3 2.3V17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8.7a2 2 0 0 1 2-2z"

          fill="none"

          stroke={fg}

          strokeWidth="1.35"

          strokeLinejoin="round"

        />

        <path d="M15 6.7V9h2.3" fill="none" stroke={fg} strokeWidth="1.35" strokeLinejoin="round" />

        <path d="M8.6 12.2h7" stroke={fg} strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round" />

        <path d="M8.6 14.9h5.2" stroke={fg} strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round" />

      </svg>

    );

  };

}



const __ReactLogoIcon = __makeIconifyTile({ icon: siReact, bg: "#111827", fg: "#61DAFB" });



const __DocTileIcon = function DocTileIcon(props: { className?: string }) {

  const { className } = props;

  return (

    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable={false}>

      <rect x="0" y="0" width="24" height="24" rx="6" fill="#374151" />

      <path d="M8 6.8h6.4L17.2 9.6V17a1.7 1.7 0 0 1-1.7 1.7H8A1.7 1.7 0 0 1 6.3 17V8.5A1.7 1.7 0 0 1 8 6.8z" fill="none" stroke="#ffffff" strokeOpacity="0.92" strokeWidth="1.4" strokeLinejoin="round" />

      <path d="M14.4 6.8V9.6h2.8" fill="none" stroke="#ffffff" strokeOpacity="0.92" strokeWidth="1.4" strokeLinejoin="round" />

      <path d="M8.4 12.3h7.2" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M8.4 14.9h5.8" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />

    </svg>

  );

};



const __SettingsTileIcon = function SettingsTileIcon(props: { className?: string }) {

  const { className } = props;

  return (

    <div className={className} aria-hidden>

      <div className="h-full w-full rounded-[6px] bg-[#4B5563] flex items-center justify-center">

        <SettingsIcon className="h-[70%] w-[70%] text-white" />

      </div>

    </div>

  );

};



const __TsLogoIcon = __makeIconifyTile({ icon: siTypescript, bg: "#3178C6", fg: "#ffffff" });

const __JsLogoIcon = __makeIconifyTile({ icon: siJavascript, bg: "#F7DF1E", fg: "#111827" });

const __HtmlLogoIcon = __makeIconifyTile({ icon: siHtml5, bg: "#E34F26", fg: "#ffffff" });

const __CssLogoIcon = __makeIconifyTile({ icon: siCss3, bg: "#1572B6", fg: "#ffffff" });

const __JsonLogoIcon = __makeIconifyTile({ icon: siJson, bg: "#111827", fg: "#ffffff" });

const __MarkdownLogoIcon = __makeIconifyTile({ icon: siMarkdown, bg: "#111827", fg: "#ffffff" });

const __GitLogoIcon = __makeIconifyTile({ icon: siGit, bg: "#F05032", fg: "#ffffff" });

const __NpmLogoIcon = __makeIconifyTile({ icon: siNpm, bg: "#CB3837", fg: "#ffffff" });

const __YarnLogoIcon = __makeIconifyTile({ icon: siYarn, bg: "#2C8EBB", fg: "#ffffff" });

const __PnpmLogoIcon = __makeIconifyTile({ icon: siPnpm, bg: "#111827", fg: "#F69220" });

const __ViteLogoIcon = __makeIconifyTile({ icon: siVite, bg: "#646CFF", fg: "#FFEA83" });

const __TailwindLogoIcon = __makeIconifyTile({ icon: siTailwindcss, bg: "#0EA5E9", fg: "#ffffff" });

const __TauriLogoIcon = __makeIconifyTile({ icon: siTauri, bg: "#0B1220", fg: "#ffffff" });

const __RustLogoIcon = __makeIconifyTile({ icon: siRust, bg: "#B7410E", fg: "#ffffff" });

const __DockerLogoIcon = __makeIconifyTile({ icon: siDocker, bg: "#2496ED", fg: "#ffffff" });



const __IconENV = __makeIconifyTile({ icon: siDotenv, bg: "#16A34A", fg: "#ffffff" });

const __IconYML = __makeIconifyTile({ icon: siYaml, bg: "#CA8A04", fg: "#ffffff" });

const __IconTOML = __makeIconifyTile({ icon: siToml, bg: "#0EA5E9", fg: "#0B1220" });

const __IconSH = __makeIconifyTile({ icon: siGnubash, bg: "#111827", fg: "#ffffff" });

const __IconSQL = __makePatternTile({ bg: "#7C3AED", seed: "sql" });

const __IconPY = __makeIconifyTile({ icon: siPython, bg: "#3776AB", fg: "#ffffff" });

const __IconGO = __makeIconifyTile({ icon: siGo, bg: "#00ADD8", fg: "#0B1220" });

const __IconJAVA = __makeIconifyTile({ icon: siJava, bg: "#EA580C", fg: "#ffffff" });

const __IconCPP = __makeIconifyTile({ icon: siCplusplus, bg: "#1D4ED8", fg: "#ffffff" });

const __IconC = __makeIconifyTile({ icon: siC, bg: "#2563EB", fg: "#ffffff" });

const __IconESLint = __makeIconifyTile({ icon: siEslint, bg: "#4B32C3", fg: "#ffffff" });

const __IconPrettier = __makeIconifyTile({ icon: siPrettier, bg: "#F7B93E", fg: "#111827" });

const __IconLock = __makePatternTile({ bg: "#6B7280", seed: "lock" });



function __extOrNameBadge(key: string) {

  const k = String(key || "").trim().toLowerCase();

  if (!k) return __DocTileIcon;

  const cached = __extIconCache.get(k);

  if (cached) return cached;

  const hue = __stableHue(k);

  const bg = `hsl(${hue}, 74%, 44%)`;

  const Comp = __makePatternTile({ bg, seed: k });

  __extIconCache.set(k, Comp);

  return Comp;

}



function fileIconFor(path: string) {

  const lower = String(path || "").replace(/\\/g, "/").toLowerCase();

  if (!lower) return __DocTileIcon;



  if (lower.startsWith("pompora:settings")) return __SettingsTileIcon;

  if (lower.startsWith("pompora:")) return __DocTileIcon;

  if (lower.startsWith("untitled:")) return __DocTileIcon;



  const name = basename(lower);



  if (name === "readme.md" || name === "license" || name === "license.md" || name === "copying") return __MarkdownLogoIcon;

  if (name === ".env" || name.startsWith(".env.")) return __IconENV;



  if (name === "package.json" || name === "package-lock.json" || name === "npm-shrinkwrap.json") return __NpmLogoIcon;

  if (name === "yarn.lock") return __YarnLogoIcon;

  if (name === "pnpm-lock.yaml") return __PnpmLogoIcon;



  if (name === "cargo.toml" || name === "cargo.lock") return __RustLogoIcon;

  if (name === "tauri.conf.json" || name === "tauri.conf.json5" || name === "tauri.toml") return __TauriLogoIcon;



  if (name === "vite.config.ts" || name === "vite.config.js" || name === "vite.config.mjs" || name === "vite.config.cjs") return __ViteLogoIcon;

  if (

    name === "tailwind.config.js" ||

    name === "tailwind.config.ts" ||

    name === "postcss.config.js" ||

    name === "postcss.config.cjs" ||

    name === "postcss.config.mjs"

  )

    return __TailwindLogoIcon;

  if (name === "eslint.config.js" || name === "eslint.config.mjs" || name === ".eslintrc" || name === ".eslintrc.json") return __IconESLint;

  if (name === ".prettierrc" || name === ".prettierrc.json" || name === ".prettierrc.js" || name === "prettier.config.js") return __IconPrettier;

  if (name === "dockerfile" || name.endsWith(".dockerfile") || name === "docker-compose.yml" || name === "docker-compose.yaml") return __DockerLogoIcon;

  if (name === ".gitignore" || name === ".gitattributes" || name === ".gitmodules") return __GitLogoIcon;



  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";



  if (ext === "tsx" || ext === "jsx") return __ReactLogoIcon;

  if (ext === "ts") return __TsLogoIcon;

  if (ext === "js" || ext === "mjs" || ext === "cjs") return __JsLogoIcon;

  if (ext === "html" || ext === "htm") return __HtmlLogoIcon;

  if (ext === "css" || ext === "scss" || ext === "sass" || ext === "less") return __CssLogoIcon;

  if (ext === "rs") return __RustLogoIcon;

  if (ext === "md" || ext === "mdx" || ext === "markdown") return __MarkdownLogoIcon;

  if (ext === "toml") return __IconTOML;

  if (ext === "yaml" || ext === "yml") return __IconYML;

  if (ext === "lock") return __IconLock;



  if (ext === "json" || ext === "jsonc" || ext === "json5") return __JsonLogoIcon;

  if (ext === "tsconfig" || ext === "tsbuildinfo") return __TsLogoIcon;



  if (ext === "sh" || ext === "bash" || ext === "zsh" || ext === "fish") return __IconSH;

  if (ext === "ps1" || ext === "bat" || ext === "cmd") return __extOrNameBadge(ext);

  if (ext === "py") return __IconPY;

  if (ext === "go") return __IconGO;

  if (ext === "java") return __IconJAVA;

  if (ext === "c") return __IconC;

  if (ext === "cpp" || ext === "cc" || ext === "cxx" || ext === "hpp" || ext === "hh" || ext === "hxx" || ext === "h") return __IconCPP;

  if (ext === "sql") return __IconSQL;



  if (

    ext === "png" ||

    ext === "jpg" ||

    ext === "jpeg" ||

    ext === "gif" ||

    ext === "webp" ||

    ext === "svg" ||

    ext === "ico" ||

    ext === "bmp" ||

    ext === "tiff" ||

    ext === "heic" ||

    ext === "heif"

  )

    return __extOrNameBadge(ext);



  if (ext === "zip" || ext === "tar" || ext === "gz" || ext === "bz2" || ext === "xz" || ext === "7z" || ext === "rar") return __extOrNameBadge(ext);

  if (ext === "mp3" || ext === "wav" || ext === "flac" || ext === "ogg" || ext === "m4a") return __extOrNameBadge(ext);

  if (ext === "mp4" || ext === "mkv" || ext === "webm" || ext === "mov" || ext === "avi") return __extOrNameBadge(ext);

  if (ext === "pdf") return __extOrNameBadge(ext);



  if (!ext) {

    if (name === "makefile") return __extOrNameBadge("mk");

    if (name === "justfile") return __extOrNameBadge("just");

    return __extOrNameBadge(name.slice(0, 4));

  }



  return __extOrNameBadge(ext);

}



function statusPillClass(status: "pending" | "running" | "done" | "error"): string {

  if (status === "done") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";

  if (status === "error") return "bg-red-500/15 text-red-300 border-red-500/25";

  if (status === "running") return "bg-sky-500/15 text-sky-300 border-sky-500/25";

  return "bg-muted/10 text-muted border-border";

}



function __splitPathSegments(p: string): string[] {

  const norm = String(p || "")

    .replace(/\\/g, "/")

    .replace(/^\/+/, "")

    .replace(/\/+$/, "");

  if (!norm) return [];

  return norm.split("/").filter(Boolean);

}



function FooterBreadcrumb(props: {

  workspaceLabel: string;

  relPath: string | null;

  fileIconPath: string | null;

  expanded: boolean;

  onToggleExpanded: () => void;

}) {

  const segments = useMemo(() => {

    const segs = [props.workspaceLabel, ...__splitPathSegments(props.relPath ?? "")];

    const full = segs.join(" > ");

    const needsCollapse = !props.expanded && segs.length > 4 && full.length > 60;

    if (!needsCollapse) return segs;

    const tailCount = Math.min(3, Math.max(1, segs.length - 1));

    return [segs[0]!, "...", ...segs.slice(-tailCount)];

  }, [props.expanded, props.relPath, props.workspaceLabel]);



  const Icon = props.fileIconPath ? fileIconFor(props.fileIconPath) : null;



  return (

    <div className="flex min-w-0 items-center gap-1 text-[12px] leading-none">

      {segments.map((seg, idx) => {

        const isLast = idx === segments.length - 1;

        const isDots = seg === "...";

        return (

          <div key={`${seg}:${idx}`} className="flex min-w-0 items-center gap-1">

            {idx > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-muted" /> : null}

            {isDots ? (

              <button type="button" className="ws-footer-btn px-1" onClick={props.onToggleExpanded}>

                ...

              </button>

            ) : (

              <div className={`flex min-w-0 items-center gap-2 ${isLast ? "text-text" : "text-muted"}`}>

                {isLast && Icon ? <Icon className="h-[18px] w-[18px] shrink-0" /> : null}

                <span className="truncate">{seg}</span>

              </div>

            )}

          </div>

        );

      })}

    </div>

  );

}



export default function AppShell() {

  const CHAT_STORAGE_KEY = "pompora.chat_sessions.v1";

  const RUN_POLICY_KEY = "pompora.terminal_run_policy.v1";

  const [activity, setActivity] = useState<ActivityId>("explorer");

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const [paletteQuery, setPaletteQuery] = useState("");

  const [paletteIndex, setPaletteIndex] = useState(0);



  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);

  const [quickOpenQuery, setQuickOpenQuery] = useState("");

  const [quickOpenIndex, setQuickOpenIndex] = useState(0);

  const [fileIndexRoot, setFileIndexRoot] = useState<string | null>(null);

  const [fileIndex, setFileIndex] = useState<string[]>([]);

  const [isFileIndexLoading, setIsFileIndexLoading] = useState(false);



  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false);

  const [goToLineValue, setGoToLineValue] = useState("");



  const [savePathDialog, setSavePathDialog] = useState<null | {

    title: string;

    subtitle?: string;

    inputLabel?: string;

    placeholder?: string;

    value: string;

    extensions?: string[];

    defaultExtension?: string;

    enforceExtension?: boolean;

    resolve: (value: string | null) => void;

  }>(null);



  const [isSavedWorkspacesOpen, setIsSavedWorkspacesOpen] = useState(false);



  const [textPromptDialog, setTextPromptDialog] = useState<null | {

    title: string;

    subtitle?: string;

    placeholder?: string;

    value: string;

    password?: boolean;

    readOnly?: boolean;

    showCopy?: boolean;

    resolve: (value: string | null) => void;

  }>(null);



  const [confirmDialog, setConfirmDialog] = useState<null | {

    title: string;

    message: string;

    confirmLabel?: string;

    danger?: boolean;

    resolve: (ok: boolean) => void;

  }>(null);



  const requestRelativePath = useCallback(

    (

      title: string,

      initialValue: string,

      options?: {

        subtitle?: string;

        inputLabel?: string;

        placeholder?: string;

        extensions?: string[];

        defaultExtension?: string;

        enforceExtension?: boolean;

      }

    ) => {

      return new Promise<string | null>((resolve) => {

        setSavePathDialog({

          title,

          subtitle: options?.subtitle,

          inputLabel: options?.inputLabel,

          placeholder: options?.placeholder,

          value: initialValue,

          extensions: options?.extensions,

          defaultExtension: options?.defaultExtension,

          enforceExtension: options?.enforceExtension,

          resolve,

        });

      });

    },

    []

  );



  const requestConfirm = useCallback(

    (title: string, message: string, options?: { confirmLabel?: string; danger?: boolean }) => {

      return new Promise<boolean>((resolve) => {

        setConfirmDialog({ title, message, confirmLabel: options?.confirmLabel, danger: options?.danger, resolve });

      });

    },

    []

  );



  const requestTextPrompt = useCallback(

    (

      title: string,

      initialValue: string,

      options?: {

        subtitle?: string;

        placeholder?: string;

        password?: boolean;

        readOnly?: boolean;

        showCopy?: boolean;

      }

    ) => {

      return new Promise<string | null>((resolve) => {

        setTextPromptDialog({

          title,

          subtitle: options?.subtitle,

          placeholder: options?.placeholder,

          value: initialValue,

          password: options?.password,

          readOnly: options?.readOnly,

          showCopy: options?.showCopy,

          resolve,

        });

      });

    },

    []

  );



  const [runPolicy, setRunPolicy] = useState<"ask" | "always">(() => {

    try {

      const raw = window.localStorage.getItem(RUN_POLICY_KEY);

      return raw === "always" ? "always" : "ask";

    } catch {

      return "ask";

    }

  });

  const [runMenuOpenId, setRunMenuOpenId] = useState<string | null>(null);



  useEffect(() => {

    try {

      window.localStorage.setItem(RUN_POLICY_KEY, runPolicy);

    } catch {

    }

  }, [RUN_POLICY_KEY, runPolicy]);



  useEffect(() => {

    if (!runMenuOpenId) return;

    const onDown = (e: MouseEvent) => {

      const t = e.target as HTMLElement | null;

      if (!t) return;

      if (!t.closest("[data-run-menu-root]")) setRunMenuOpenId(null);

    };

    window.addEventListener("mousedown", onDown);

    return () => window.removeEventListener("mousedown", onDown);

  }, [runMenuOpenId]);



  const [settings, setSettingsState] = useState<AppSettings>({

    theme: "dark",

    offline_mode: false,

    active_provider: null,

    active_model: null,

    pompora_thinking: null,

    editor_cursor_blinking: "expand",

    editor_line_highlight_color: null,

    editor_cursor_color: null,

    keybindings: DEFAULT_KEYBINDINGS,

    workspace_root: null,

    recent_workspaces: [],

    saved_workspaces: [],

  });

  const settingsMutationSeqRef = useRef(0);

  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [isTogglingOffline, setIsTogglingOffline] = useState(false);



  const [workspace, setWorkspaceState] = useState<WorkspaceInfo>({ root: null, recent: [] });



  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);



  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

  const [isFileMenuRecentOpen, setIsFileMenuRecentOpen] = useState(false);

  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);

  const [isSelectionMenuOpen, setIsSelectionMenuOpen] = useState(false);

  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

  const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);

  const [isTerminalMenuOpen, setIsTerminalMenuOpen] = useState(false);



  const [viewMenuSub, setViewMenuSub] = useState<null | "appearance" | "editorLayout">(null);

  const [viewAppearanceSub, setViewAppearanceSub] = useState<

    | null

    | "activityBarPosition"

    | "secondaryActivityBarPosition"

    | "panelPosition"

    | "alignPanel"

    | "tabBar"

    | "editorActionsPosition"

  >(null);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);



  const [fileRecentAnchor, setFileRecentAnchor] = useState<DOMRect | null>(null);

  const [viewAppearanceAnchor, setViewAppearanceAnchor] = useState<DOMRect | null>(null);

  const [viewEditorLayoutAnchor, setViewEditorLayoutAnchor] = useState<DOMRect | null>(null);

  const [viewAppearanceSubAnchor, setViewAppearanceSubAnchor] = useState<DOMRect | null>(null);



  const closeMenubarMenus = useCallback(() => {

    setIsFileMenuOpen(false);

    setIsFileMenuRecentOpen(false);

    setIsEditMenuOpen(false);

    setIsSelectionMenuOpen(false);

    setIsViewMenuOpen(false);

    setIsRunMenuOpen(false);

    setIsTerminalMenuOpen(false);

    setViewMenuSub(null);

    setViewAppearanceSub(null);

    setFileRecentAnchor(null);

    setViewAppearanceAnchor(null);

    setViewEditorLayoutAnchor(null);

    setViewAppearanceSubAnchor(null);

  }, []);



  const fileRecentCloseTimerRef = useRef<number | null>(null);

  const clearFileRecentCloseTimer = useCallback(() => {

    if (fileRecentCloseTimerRef.current) {

      window.clearTimeout(fileRecentCloseTimerRef.current);

      fileRecentCloseTimerRef.current = null;

    }

  }, []);

  const scheduleFileRecentClose = useCallback(() => {

    clearFileRecentCloseTimer();

    fileRecentCloseTimerRef.current = window.setTimeout(() => {

      setIsFileMenuRecentOpen(false);

      fileRecentCloseTimerRef.current = null;

    }, 120);

  }, [clearFileRecentCloseTimer]);



  const anyMenubarOpen =

    isFileMenuOpen ||

    isEditMenuOpen ||

    isSelectionMenuOpen ||

    isViewMenuOpen ||

    isRunMenuOpen ||

    isTerminalMenuOpen;



  useEffect(() => {

    const onClose = () => closeMenubarMenus();

    window.addEventListener("pompora:menubar-close", onClose);

    return () => window.removeEventListener("pompora:menubar-close", onClose);

  }, [closeMenubarMenus]);



  useEffect(() => {

    // Ensure timers don't keep running after a hard close.

    if (!isFileMenuOpen) {

      clearFileRecentCloseTimer();

      setIsFileMenuRecentOpen(false);

    }

  }, [clearFileRecentCloseTimer, isFileMenuOpen]);

  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  const [explorer, setExplorer] = useState<Record<string, DirEntryInfo[]>>({});

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const [inlineRenamePath, setInlineRenamePath] = useState<string | null>(null);

  const [inlineRenameValue, setInlineRenameValue] = useState<string>("");



  const [footerPathExpanded, setFooterPathExpanded] = useState(false);



  const [tabs, setTabs] = useState<EditorTab[]>([]);

  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);



  const tabsScrollRef = useRef<HTMLDivElement | null>(null);

  const tabsIndicatorHideTimerRef = useRef<number | null>(null);

  const [tabsIndicator, setTabsIndicator] = useState<{ visible: boolean; leftPx: number; widthPx: number }>({

    visible: false,

    leftPx: 0,

    widthPx: 0,

  });



  const tabNavRef = useRef<{ history: string[]; index: number; suppress: boolean }>({ history: [], index: -1, suppress: false });

  const [tabNavAvail, setTabNavAvail] = useState<{ back: boolean; forward: boolean }>({ back: false, forward: false });



  const updateTabsIndicator = useCallback(() => {

    const el = tabsScrollRef.current;

    if (!el) return;



    const cw = el.clientWidth;

    const sw = el.scrollWidth;

    if (!cw || sw <= cw) {

      setTabsIndicator((prev) => (prev.visible || prev.widthPx !== 0 ? { visible: false, leftPx: 0, widthPx: 0 } : prev));

      return;

    }



    const maxLeft = sw - cw;

    const t = maxLeft > 0 ? el.scrollLeft / maxLeft : 0;



    const minW = 22;

    const maxW = 64;

    const w = Math.max(minW, Math.min(maxW, Math.round((cw * cw) / sw)));

    const left = Math.round(t * Math.max(0, cw - w));



    setTabsIndicator({ visible: true, leftPx: left, widthPx: w });



    if (tabsIndicatorHideTimerRef.current) window.clearTimeout(tabsIndicatorHideTimerRef.current);

    tabsIndicatorHideTimerRef.current = window.setTimeout(() => {

      setTabsIndicator((prev) => ({ ...prev, visible: false }));

      tabsIndicatorHideTimerRef.current = null;

    }, 650);

  }, []);



  useEffect(() => {

    const onResize = () => updateTabsIndicator();

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);

  }, [updateTabsIndicator]);



  useEffect(() => {

    return () => {

      if (tabsIndicatorHideTimerRef.current) window.clearTimeout(tabsIndicatorHideTimerRef.current);

    };

  }, []);



  const [searchQuery, setSearchQuery] = useState("");

  const [searchResults, setSearchResults] = useState<Array<{ path: string; line: number; text: string }>>([]);

  const [isSearching, setIsSearching] = useState(false);

  const [pendingReveal, setPendingReveal] = useState<{ path: string; line: number; text: string } | null>(null);



  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);

  const [apiKeyDraft, setApiKeyDraft] = useState("");

  const [encryptionPasswordDraft, setEncryptionPasswordDraft] = useState("");

  const [secretsError, setSecretsError] = useState<string | null>(null);

  const [providerKeyStatuses, setProviderKeyStatuses] = useState<Record<string, KeyStatus | null>>({});

  const [isKeyOperationInProgress, setIsKeyOperationInProgress] = useState(false);

  const [showKeySaved, setShowKeySaved] = useState(false);

  const [showKeyCleared, setShowKeyCleared] = useState(false);

  const [debugResult, setDebugResult] = useState<string | null>(null);



  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);

  const [authCredits, setAuthCredits] = useState<CreditsResponse | null>(null);

  const [isAuthBusy, setIsAuthBusy] = useState(false);

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);



  const initialChatIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const [chatHistoryQueryDraft, setChatHistoryQueryDraft] = useState("");

  const [chatHistoryQuery, setChatHistoryQuery] = useState("");

  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {

    const now = Date.now();

    return [

      {

        id: initialChatIdRef.current,

        title: "Chat 1",

        createdAt: now,

        updatedAt: now,

        messages: [],

        logs: [],

        draft: "",

        changeSet: null,

      },

    ];

  });

  const [activeChatId, setActiveChatId] = useState<string>(() => chatSessions[0]?.id ?? initialChatIdRef.current);



  const [chatBusy, setChatBusy] = useState(false);

  const [chatApplying, setChatApplying] = useState(false);

  const [isChatDockOpen, setIsChatDockOpen] = useState(false);

  const [chatDockWidth, setChatDockWidth] = useState(340);

  const [explorerWidth, setExplorerWidth] = useState(300);

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const [terminalHeight, setTerminalHeight] = useState(240);

  const [panelTab, setPanelTab] = useState<"problems" | "output" | "debug" | "terminal" | "ports">("terminal");

  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);

  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);

  const [uiPomporaThinking, setUiPomporaThinking] = useState<"slow" | "fast" | "reasoning" | null>(null);

  const [providerModels, setProviderModels] = useState<Record<string, Array<{ id: string; name?: string | null }>>>({});

  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});

  const [providerModelsError, setProviderModelsError] = useState<Record<string, string | null>>({});



  const formatErr = useCallback((e: unknown): string => {

    if (e instanceof Error) {

      return e.message || String(e);

    }

    if (typeof e === "string") return e;

    if (e === null) return "<null>";

    if (e === undefined) return "<undefined>";

    try {

      const s = JSON.stringify(e);

      return s && s !== "{}" ? s : String(e);

    } catch {

      return String(e);

    }

  }, []);



  const shortAiProviderErr = useCallback((raw: string): string => {

    const msg = raw.trim();

    if (!msg) return msg;



    if (/Incorrect API key provided/i.test(msg) || /invalid[_\s-]*api[_\s-]*key/i.test(msg)) {

      return "Invalid API key";

    }



    const m = msg.match(/status\s+(\d+)/i);

    const status = m ? Number(m[1]) : null;

    if (status === 401 || status === 403) return "Authorization failed";

    if (status === 429) return "Rate limited";

    if (status === 402) return "Payment required";



    if (/Unauthorized/i.test(msg)) return "Unauthorized";

    if (/rate limit/i.test(msg)) return "Rate limited";

    if (/timeout/i.test(msg)) return "Request timed out";



    const firstLine = msg.split(/\r?\n/)[0]?.trim() ?? msg;

    return firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine;

  }, []);



  useEffect(() => {

    const t = window.setTimeout(() => {

      setChatHistoryQuery(chatHistoryQueryDraft.trim());

    }, 140);

    return () => window.clearTimeout(t);

  }, [chatHistoryQueryDraft]);



  const chatHistorySessions = useMemo(() => {

    const q = chatHistoryQuery.trim().toLowerCase();

    const rawTokens = q.split(/\s+/).map((t) => t.trim()).filter(Boolean);

    const tokens = rawTokens.length ? rawTokens : q ? [q] : [];



    const all = chatSessions

      .slice()

      .sort((a, b) => b.updatedAt - a.updatedAt)

      .filter((s) => s.messages.some((m) => m.role === "user"))

      .map((s) => {

        if (!tokens.length) return { s, score: 0, titleMatch: true };



        const userText = s.messages

          .filter((m) => m.role === "user")

          .map((m) => m.content)

          .join("\n");

        const titleHay = s.title.toLowerCase();

        const userHay = userText.toLowerCase();



        const titleMatch = tokens.every((tok) => titleHay.includes(tok));

        const userMatch = tokens.every((tok) => userHay.includes(tok));

        if (!titleMatch && !userMatch) return null;



        let score = 0;

        for (const tok of tokens) {

          const w = tok.length >= 4 ? 2 : 1;

          if (titleHay.includes(tok)) score += w * 4;

          else score += w;

        }

        if (titleMatch) score += 100;

        return { s, score, titleMatch };

      })

      .filter((x): x is { s: ChatSession; score: number; titleMatch: boolean } => x !== null);



    const scored = tokens.length && all.some((x) => x.titleMatch) ? all.filter((x) => x.titleMatch) : all;



    return scored

      .sort((a, b) => b.score - a.score || b.s.updatedAt - a.s.updatedAt)

      .slice(0, 120)

      .map((x) => x.s);

  }, [chatHistoryQuery, chatSessions]);



  useEffect(() => {

    if (!chatSessions.length) return;

    if (chatSessions.some((s) => s.id === activeChatId)) return;

    setActiveChatId(chatSessions[0]!.id);

  }, [activeChatId, chatSessions]);



  const devConsoleError = useCallback(

    (...args: any[]) => {

      if (!import.meta.env?.DEV) return;

      console.error(...args);

    },

    []

  );



  const didLoadChatHistoryRef = useRef(false);

  const isWritingChatHistoryRef = useRef(false);

  const chatHistoryBtnRef = useRef<HTMLButtonElement | null>(null);



  useEffect(() => {

    if (didLoadChatHistoryRef.current) return;



    let cancelled = false;



    (async () => {

      // 1) Load history from local file (tauri backend).

      let raw: string | null = null;

      try {

        raw = await historyGetRaw();

      } catch {

        raw = null;

      }



      const tryParseSessions = (rawStr: string | null): ChatSession[] | null => {

        if (!rawStr) return null;

        try {

          const parsed = JSON.parse(rawStr) as unknown;

          if (!Array.isArray(parsed)) return null;

          const now = Date.now();

          const restored = parsed

            .filter((x: any) => x && typeof x.id === "string")

            .map((x: any) => ({

              id: String(x.id),

              title: typeof x.title === "string" ? x.title : "Chat",

              createdAt: typeof x.createdAt === "number" ? x.createdAt : now,

              updatedAt: typeof x.updatedAt === "number" ? x.updatedAt : now,

              messages: Array.isArray(x.messages)

                ? (x.messages.map((m: any) => migrateStoredChatMessage(m)).filter(Boolean) as ChatUiMessage[])

                : ([] as ChatUiMessage[]),

              logs: Array.isArray(x.logs) ? (x.logs as ChatLogEntry[]) : ([] as ChatLogEntry[]),

              draft: typeof x.draft === "string" ? x.draft : "",

              changeSet: (x.changeSet as ChangeSet | null) ?? null,

            }))

            .slice(0, 200);

          return restored.length ? restored : null;

        } catch {

          return null;

        }

      };



      let loaded = tryParseSessions(raw);



      // 2) One-time migration: if file history is empty, try old localStorage key.

      if (!loaded) {

        try {

          const legacy = window.localStorage.getItem(CHAT_STORAGE_KEY);

          loaded = tryParseSessions(legacy);

          if (loaded) {

            // persist migrated data to file

            try {

              isWritingChatHistoryRef.current = true;

              await historySetRaw(JSON.stringify(loaded));

            } catch {

            } finally {

              isWritingChatHistoryRef.current = false;

            }

            try {

              window.localStorage.removeItem(CHAT_STORAGE_KEY);

            } catch {

            }

          }

        } catch {

        }

      }



      if (cancelled) return;

      if (loaded) {

        setChatSessions(loaded);

        if (loaded.some((s) => s.id === activeChatId)) {

          // keep current

        } else {

          setActiveChatId(loaded[0]!.id);

        }

      } else {

        const now = Date.now();

        const id = `${now}-${Math.random().toString(16).slice(2)}`;

        setChatSessions([{ id, title: "Chat", createdAt: now, updatedAt: now, messages: [], logs: [], draft: "", changeSet: null }]);

        setActiveChatId(id);

      }



      // Mark history as initialized only after we've loaded/migrated and set initial state.

      didLoadChatHistoryRef.current = true;

    })();



    return () => {

      cancelled = true;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  useEffect(() => {

    if (!didLoadChatHistoryRef.current) return;

    if (isWritingChatHistoryRef.current) return;



    const t = window.setTimeout(() => {

      (async () => {

        try {

          isWritingChatHistoryRef.current = true;

          await historySetRaw(JSON.stringify(chatSessions));

        } catch (e) {

          devConsoleError("Failed to save chat history", e);

        } finally {

          isWritingChatHistoryRef.current = false;

        }

      })();

    }, 250);

    return () => window.clearTimeout(t);

  }, [chatSessions, devConsoleError]);



  const flushChatHistoryNow = useCallback(async () => {

    if (!didLoadChatHistoryRef.current) return;

    if (isWritingChatHistoryRef.current) return;

    try {

      isWritingChatHistoryRef.current = true;

      await historySetRaw(JSON.stringify(chatSessions));

    } catch (e) {

      devConsoleError("Failed to flush chat history", e);

    } finally {

      isWritingChatHistoryRef.current = false;

    }

  }, [chatSessions, devConsoleError]);



  useEffect(() => {

    const onVis = () => {

      if (document.visibilityState === "hidden") {

        void flushChatHistoryNow();

      }

    };

    window.addEventListener("visibilitychange", onVis);

    window.addEventListener("beforeunload", onVis);

    return () => {

      window.removeEventListener("visibilitychange", onVis);

      window.removeEventListener("beforeunload", onVis);

    };

  }, [flushChatHistoryNow]);



  const [notifications] = useState<AppNotification[]>([]);



  const activeChat = useMemo<ChatSession>(() => {

    const found = chatSessions.find((s) => s.id === activeChatId);

    return found ?? chatSessions[0]!;

  }, [activeChatId, chatSessions]);



  const chatMessagesRef = useRef<ChatUiMessage[]>([]);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const chatComposerRef = useRef<HTMLTextAreaElement | null>(null);

  const chatStreamTimerRef = useRef<number | null>(null);

  const chatResizeStateRef = useRef<{ startX: number; startW: number } | null>(null);

  const explorerResizeStateRef = useRef<{ startX: number; startW: number } | null>(null);

  const terminalResizeStateRef = useRef<{ startY: number; startH: number } | null>(null);

  const chatHistoryMenuRef = useRef<HTMLDivElement | null>(null);

  const notifyRef = useRef<((n: Omit<AppNotification, "id">) => void) | null>(null);

  const sendChatRef = useRef<(() => Promise<void>) | null>(null);

  const refreshDirRef = useRef<((relDir?: string) => Promise<void>) | null>(null);

  const metaQueueRef = useRef<string[]>([]);

  const metaFlushTimerRef = useRef<number | null>(null);

  const lastQueuedMetaRef = useRef<string>("");

  const logStreamIdRef = useRef<Record<string, string>>({});



  const activeEventStreamIdRef = useRef<string | null>(null);



  const termIdRef = useRef<string | null>(null);

  const termRef = useRef<XTermTerminal | null>(null);

  const fitAddonRef = useRef<FitAddon | null>(null);

  const termHostRef = useRef<HTMLDivElement | null>(null);

  const termUnlistenRef = useRef<(() => void) | null>(null);

  const termCaptureRef = useRef<TerminalCapture | null>(null);

  const termInitPromiseRef = useRef<Promise<void> | null>(null);

  const termCwdRef = useRef<string | null>(null);



  const mainGridTemplateColumns = useMemo(() => {

    const cols: string[] = ["52px", `minmax(220px, ${explorerWidth}px)`, "minmax(0, 1fr)"];

    if (isChatDockOpen) cols.push(`minmax(280px, ${chatDockWidth}px)`);

    return cols.join(" ");

  }, [chatDockWidth, explorerWidth, isChatDockOpen]);



  useEffect(() => {

    if (!isChatHistoryOpen) return;



    const onDown = (e: MouseEvent) => {

      const t = e.target as Node | null;

      if (!t) return;

      if (chatHistoryMenuRef.current?.contains(t)) return;

      setIsChatHistoryOpen(false);

    };



    window.addEventListener("mousedown", onDown);

    return () => window.removeEventListener("mousedown", onDown);

  }, [isChatHistoryOpen]);



  const nextChatTitle = useMemo(() => {

    const nums = chatSessions

      .map((s) => {

        const m = s.title.match(/\bChat\s+(\d+)\b/i);

        return m ? Number(m[1]) : null;

      })

      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

    const max = nums.length ? Math.max(...nums) : 0;

    return `Chat ${max + 1}`;

  }, [chatSessions]);



  const deleteChatSession = useCallback(

    (id: string) => {

      let nextActive: string | null = null;

      setChatSessions((prev) => {

        const remaining = prev.filter((s) => s.id !== id);

        if (id === activeChatId) {

          const next = remaining

            .slice()

            .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id;

          if (next) {

            nextActive = next;

          } else {

            const now = Date.now();

            const newId = `${now}-${Math.random().toString(16).slice(2)}`;

            nextActive = newId;

            return [{ id: newId, title: "Chat", createdAt: now, updatedAt: now, messages: [], logs: [], draft: "", changeSet: null }];

          }

        }

        return remaining.length ? remaining : prev;

      });



      if (nextActive) setActiveChatId(nextActive);

      setIsChatHistoryOpen(false);

      window.setTimeout(() => chatComposerRef.current?.focus(), 0);

    },

    [activeChatId]

  );



  const renameChatSession = useCallback(

    (id: string) => {

      void (async () => {

        const current = chatSessions.find((s) => s.id === id);

        const next = await requestTextPrompt("Chat name", current?.title || "Chat", { placeholder: "Chat" });

        const title = String(next ?? "").trim();

        if (!title) return;

        setChatSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title, updatedAt: Date.now() } : s)));

      })();

    },

    [chatSessions, requestTextPrompt]

  );



  const setActiveChatTitle = useCallback(

    (title: string) => {

      setChatSessions((prev) =>

        prev.map((s) => (s.id === activeChatId ? { ...s, title, updatedAt: Date.now() } : s))

      );

    },

    [activeChatId]

  );



  const setActiveChatDraft = useCallback(

    (draft: string) => {

      setChatSessions((prev) => prev.map((s) => (s.id === activeChatId ? { ...s, draft } : s)));

    },

    [activeChatId]

  );



  const setActiveChatMessages = useCallback(

    (messages: ChatUiMessage[] | ((prev: ChatUiMessage[]) => ChatUiMessage[])) => {

      setChatSessions((prev) =>

        prev.map((s) => {

          if (s.id !== activeChatId) return s;

          const nextMsgs = typeof messages === "function" ? messages(s.messages) : messages;

          return { ...s, messages: nextMsgs, updatedAt: Date.now() };

        })

      );

    },

    [activeChatId]

  );



  const setActiveChatLogs = useCallback(

    (logs: ChatLogEntry[] | ((prev: ChatLogEntry[]) => ChatLogEntry[])) => {

      setChatSessions((prev) =>

        prev.map((s) => {

          if (s.id !== activeChatId) return s;

          const nextLogs = typeof logs === "function" ? logs(s.logs) : logs;

          return { ...s, logs: nextLogs, updatedAt: Date.now() };

        })

      );

    },

    [activeChatId]

  );



  const addLog = useCallback(

    (input: Omit<ChatLogEntry, "id" | "ts"> & { id?: string; ts?: number }) => {

      const now = Date.now();

      const id = input.id ?? `log-${now}-${Math.random().toString(16).slice(2)}`;

      const groupId = input.groupId ?? activeEventStreamIdRef.current ?? "session";

      const entry: ChatLogEntry = {

        id,

        ts: input.ts ?? now,

        groupId,

        kind: input.kind,

        title: input.title,

        status: input.status,

        details: input.details,

        collapsed: input.collapsed ?? true,

      };

      setActiveChatLogs((prev) => [...prev, entry].slice(-400));

      return id;

    },

    [setActiveChatLogs]

  );



  const setLogStatus = useCallback(

    (id: string, status: NonNullable<ChatLogEntry["status"]>) => {

      setActiveChatLogs((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

    },

    [setActiveChatLogs]

  );



  const appendLogDetail = useCallback(

    (id: string, line: string) => {

      const t = String(line || "").trim();

      if (!t) return;

      setActiveChatLogs((prev) =>

        prev.map((l) =>

          l.id === id

            ? {

                ...l,

                details: ([...(l.details ?? []), t].slice(-240) as string[]),

              }

            : l

        )

      );

    },

    [setActiveChatLogs]

  );



  const appendActivityStep = useCallback(

    (activityId: string, step: string, opts?: { detail?: boolean }) => {

      const t = String(step || "").trim();

      if (!t) return;

      setActiveChatMessages((prev) =>

        prev.map((m) => {

          if (m.id !== activityId || m.kind !== "activity" || !m.activity) return m;

          const steps = opts?.detail ? m.activity.steps : [...m.activity.steps, t].slice(-80);

          const details = opts?.detail ? [...(m.activity.details ?? []), t].slice(-200) : m.activity.details;

          return { ...m, activity: { ...m.activity, steps, details } };

        })

      );

    },

    [setActiveChatMessages]

  );



  const toggleActivityCollapsed = useCallback(

    (activityId: string) => {

      setActiveChatMessages((prev) =>

        prev.map((m) => {

          if (m.id !== activityId || m.kind !== "activity" || !m.activity) return m;

          return { ...m, activity: { ...m.activity, collapsed: !m.activity.collapsed } };

        })

      );

    },

    [setActiveChatMessages]

  );



  const setActivityStatus = useCallback(

    (activityId: string, status: "pending" | "running" | "done" | "error") => {

      setActiveChatMessages((prev) =>

        prev.map((m) =>

          m.id === activityId && m.kind === "activity" && m.activity ? { ...m, activity: { ...m.activity, status } } : m

        )

      );

    },

    [setActiveChatMessages]

  );



  const setActivityProgress = useCallback(

    (activityId: string, progress: { done: number; total: number; current?: string }) => {

      setActiveChatMessages((prev) =>

        prev.map((m) =>

          m.id === activityId && m.kind === "activity" && m.activity

            ? { ...m, activity: { ...m.activity, progress } }

            : m

        )

      );

    },

    [setActiveChatMessages]

  );



  const enqueueMetaLine = useCallback(

    (raw: string) => {

      const line = raw.trim();

      if (!line) return;



      // Avoid obvious duplicates (prompt echoes, repeated spinner lines, etc.)

      if (lastQueuedMetaRef.current === line) return;

      lastQueuedMetaRef.current = line;



      metaQueueRef.current.push(line);

      if (metaFlushTimerRef.current) return;



      const groupId = activeEventStreamIdRef.current ?? "session";

      const streamMap = logStreamIdRef.current;



      if (!streamMap[groupId]) {

        streamMap[groupId] = addLog({ kind: "info", title: "Activity", status: "running", details: [], collapsed: false, groupId });

      }

      const streamId = streamMap[groupId];



      metaFlushTimerRef.current = window.setInterval(() => {

        const next = metaQueueRef.current.shift();

        if (!next) {

          if (metaFlushTimerRef.current) window.clearInterval(metaFlushTimerRef.current);

          metaFlushTimerRef.current = null;

          if (streamId) {

            setLogStatus(streamId, "done");

            delete streamMap[groupId];

          }

          return;

        }

        if (streamId) appendLogDetail(streamId, next);

      }, 80);

    },

    [addLog, appendLogDetail, setLogStatus]

  );



  const askAiToFixRunError = useCallback(

    async (messageId: string) => {

      const current = (chatMessagesRef.current ?? []).find((m) => m.id === messageId);

      if (!current?.run) return;

      const cmd = current.run.cmd;

      const tail = Array.isArray(current.run.tail) ? current.run.tail.join("\n") : "";

      const err = (current.run.error ?? "").trim();



      const prompt =

        `The following terminal command failed:\n\n${cmd}\n\n` +

        (err ? `Error summary:\n${err}\n\n` : "") +

        (tail ? `Terminal output (tail):\n${tail}\n\n` : "") +

        "Fix the issue and propose the minimal next terminal commands to resolve it. Return JSON edits.";



      setActiveChatDraft(prompt);

      window.setTimeout(() => {

        void sendChatRef.current?.();

      }, 0);

    },

    [setActiveChatDraft]

  );



  const setActiveChatChangeSet = useCallback(

    (changeSet: ChangeSet | null) => {

      setChatSessions((prev) => prev.map((s) => (s.id === activeChatId ? { ...s, changeSet, updatedAt: Date.now() } : s)));

    },

    [activeChatId]

  );



  useEffect(() => {

    const onMove = (e: MouseEvent) => {

      if (chatResizeStateRef.current) {

        const { startX, startW } = chatResizeStateRef.current;

        const max = Math.max(280, Math.min(620, Math.floor(window.innerWidth * 0.6)));

        const next = clamp(startW + (startX - e.clientX), 280, max);

        setChatDockWidth(next);

      }

      if (explorerResizeStateRef.current) {

        const { startX, startW } = explorerResizeStateRef.current;

        const max = Math.max(280, Math.min(520, Math.floor(window.innerWidth * 0.45)));

        const next = clamp(startW + (e.clientX - startX), 220, max);

        setExplorerWidth(next);

      }

      if (terminalResizeStateRef.current) {

        const { startY, startH } = terminalResizeStateRef.current;

        const max = Math.max(160, Math.min(520, Math.floor(window.innerHeight * 0.7)));

        const next = clamp(startH + (startY - e.clientY), 160, max);

        setTerminalHeight(next);

      }

    };

    const onUp = () => {

      chatResizeStateRef.current = null;

      explorerResizeStateRef.current = null;

      terminalResizeStateRef.current = null;

    };

    window.addEventListener("mousemove", onMove);

    window.addEventListener("mouseup", onUp);

    return () => {

      window.removeEventListener("mousemove", onMove);

      window.removeEventListener("mouseup", onUp);

    };

  }, []);



  const ensureTerminal = useCallback(async () => {

    if (termRef.current && termIdRef.current) return;

    if (termInitPromiseRef.current) return termInitPromiseRef.current;



    const p = (async () => {

      const host = termHostRef.current;

      if (!host) return;



      host.innerHTML = "";



      const t = new XTermTerminal({

        fontSize: 12,

        fontFamily:

          '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',

        cursorBlink: true,

        cursorStyle: "bar",

        cursorWidth: 2,

        lineHeight: 1.15,

        scrollback: 8000,

        convertEol: true,

        theme: {

          background: "rgb(12, 12, 12)",

          foreground: "rgb(244, 244, 245)",

          cursor: "rgb(244, 244, 245)",

          selectionBackground: "rgba(112, 163, 255, 0.25)",

        },

      });

      const fit = new FitAddon();

      t.loadAddon(fit);

      t.open(host);

      fit.fit();



      termRef.current = t;

      fitAddonRef.current = fit;



      if (termUnlistenRef.current) {

        try {

          termUnlistenRef.current();

        } catch {

        }

        termUnlistenRef.current = null;

      }



      const { cols, rows } = t;

      const cwd = workspace.root ?? settings.workspace_root ?? null;

      const id = await terminalStart({ cols, rows, cwd });

      termIdRef.current = id;

      termCwdRef.current = cwd;



      t.onData((data: string) => {

        const tid = termIdRef.current;

        if (!tid) return;

        void terminalWrite({ id: tid, data });

      });



      termUnlistenRef.current = await listen<{ id: string; data: string }>("terminal:data", (ev) => {

        const tid = termIdRef.current;

        if (!tid) return;

        if (ev.payload.id !== tid) return;

        termRef.current?.write(ev.payload.data);



        const cap = termCaptureRef.current;

        if (!cap) return;

        if (cap.id !== tid) return;



        const now = Date.now();

        cap.lastDataAt = now;

        cap.buffer += ev.payload.data;



        // Flush at most every 220ms to avoid chat spam.

        if (now - cap.lastFlushAt < 220) return;

        cap.lastFlushAt = now;



        const parts = cap.buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

        cap.buffer = parts.pop() ?? "";



        for (const raw of parts) {

          if (cap.emitted >= cap.maxEmitted) break;

          const line = stripAnsiForLog(raw).trimEnd();

          if (!line.trim()) continue;

          cap.emitted += 1;

          cap.emit(line);

        }



        // Don't clear capture here; runTerminalCommand will clear it after the command becomes idle.

      });

    })();



    termInitPromiseRef.current = p

      .catch((e) => {

        try {

          termRef.current?.dispose();

        } catch {

        }

        termRef.current = null;

        fitAddonRef.current = null;

        termIdRef.current = null;

        const host = termHostRef.current;

        if (host) host.innerHTML = "";

        throw e;

      })

      .finally(() => {

        termInitPromiseRef.current = null;

      });



    return termInitPromiseRef.current;

  }, [settings.workspace_root, workspace.root]);



  const resizeTerminal = useCallback(() => {

    const t = termRef.current;

    const id = termIdRef.current;

    const fit = fitAddonRef.current;

    if (!t || !id || !fit) return;

    fit.fit();

    void terminalResize({ id, cols: t.cols, rows: t.rows });

  }, []);



  useEffect(() => {

    if (!isTerminalOpen) return;

    if (panelTab !== "terminal") return;

    void ensureTerminal();

    const host = termHostRef.current;

    if (!host) return;

    const ro = new ResizeObserver(() => resizeTerminal());

    ro.observe(host);

    return () => ro.disconnect();

  }, [ensureTerminal, isTerminalOpen, panelTab, resizeTerminal, terminalHeight]);



  const closeTerminal = useCallback(async () => {

    setIsTerminalOpen(false);

    const id = termIdRef.current;

    termIdRef.current = null;



    termCwdRef.current = null;



    termInitPromiseRef.current = null;



    termCaptureRef.current = null;



    if (termUnlistenRef.current) {

      try {

        termUnlistenRef.current();

      } catch {

      }

      termUnlistenRef.current = null;

    }



    try {

      if (id) await terminalKill({ id });

    } catch {

    }

    try {

      termRef.current?.dispose();

    } catch {

    }

    termRef.current = null;

    fitAddonRef.current = null;



    const host = termHostRef.current;

    if (host) host.innerHTML = "";

  }, []);



  const toggleTerminal = useCallback(() => {

    if (isTerminalOpen) {

      void closeTerminal();

      return;

    }



    setPanelTab("terminal");

    setIsTerminalOpen(true);

    window.setTimeout(() => {

      void ensureTerminal().then(() => {

        resizeTerminal();

        termRef.current?.focus();

      });

    }, 0);

  }, [closeTerminal, ensureTerminal, isTerminalOpen, resizeTerminal]);



  const runTerminalCommand = useCallback(

    async (cmd: string, onStep?: (msg: string) => void) => {

      const c = cmd.trim();

      if (!c) return;



      if (isLikelyDangerousCommand(c)) {

        const ok = await requestConfirm(

          "Run command",

          `The app is about to run a potentially dangerous command:\n\n${c}\n\nRun anyway?`,

          { danger: true, confirmLabel: "Run" }

        );

        if (!ok) return;

      }



      setPanelTab("terminal");

      setIsTerminalOpen(true);



      const desiredCwd = workspace.root ?? settings.workspace_root ?? null;

      if (termIdRef.current && termCwdRef.current && desiredCwd && termCwdRef.current !== desiredCwd) {

        await closeTerminal();

        setPanelTab("terminal");

        setIsTerminalOpen(true);

      }



      // Wait for terminal host to mount before starting the PTY.

      for (let i = 0; i < 30; i++) {

        if (termHostRef.current) break;

        await new Promise<void>((r) => window.setTimeout(r, 50));

      }



      await ensureTerminal();

      resizeTerminal();



      window.setTimeout(() => {

        try {

          termRef.current?.focus();

        } catch {

        }

      }, 0);



      const tid = termIdRef.current;

      if (!tid) throw new Error("Terminal not available");



      onStep?.(`run ${c}`);



      termCaptureRef.current = {

        id: tid,

        startedAt: Date.now(),

        lastDataAt: Date.now(),

        lastFlushAt: 0,

        buffer: "",

        emitted: 0,

        maxEmitted: 28,

        emit: (line) => onStep?.(`terminal ${line}`),

      };



      await terminalWrite({ id: tid, data: c + "\r" });



      // Wait for terminal to go idle before returning so Explorer refresh happens after file changes land.

      const startedAt = Date.now();

      const maxWaitMs = 15000;

      const idleMs = 650;

      const minRunMs = 350;

      await new Promise<void>((resolve) => {

        const timer = window.setInterval(() => {

          const now = Date.now();

          if (now - startedAt > maxWaitMs) {

            window.clearInterval(timer);

            termCaptureRef.current = null;

            resolve();

            return;

          }

          const cap = termCaptureRef.current;

          if (!cap || cap.id !== tid) {

            if (now - startedAt >= minRunMs) {

              window.clearInterval(timer);

              termCaptureRef.current = null;

              resolve();

            }

            return;

          }

          if (now - startedAt < minRunMs) return;

          if (now - cap.lastDataAt >= idleMs) {

            window.clearInterval(timer);

            termCaptureRef.current = null;

            resolve();

          }

        }, 120);

      });

    },

    [closeTerminal, ensureTerminal, resizeTerminal, settings.workspace_root, workspace.root]

  );



  const refreshWorkspaceAfterRun = useCallback(async () => {

    setFileIndexRoot(null);

    setFileIndex([]);

    await refreshDirRef.current?.(undefined);

    const dirs = Array.from(expandedDirs);

    for (const d of dirs) await refreshDirRef.current?.(d);

  }, [expandedDirs]);



  const pushRunRequest = useCallback(

    (cmd: string, remaining: string[]) => {

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setActiveChatMessages((prev) => [

        ...prev,

        {

          id,

          role: "assistant",

          content: "",

          kind: "run_request",

          run: { cmd, status: "pending", remaining, error: null, tail: null, autoFixRequested: false },

        },

      ]);

    },

    [setActiveChatMessages]

  );



  const runFromRunCard = useCallback(

    async (messageId: string, mode: "once" | "always") => {

      if (mode === "always") setRunPolicy("always");



      const current = (chatMessagesRef.current ?? []).find((m) => m.id === messageId);

      if (!current?.run || current.kind !== "run_request") return;



      const cmd = current.run.cmd;

      const remaining = Array.isArray(current.run.remaining) ? current.run.remaining : [];



      setActiveChatMessages((prev) =>

        prev.map((m) => (m.id === messageId ? { ...m, run: m.run ? { ...m.run, status: "running" } : m.run } : m))

      );



      const tail: string[] = [];



      const activityId = `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setActiveChatMessages((prev) => [

        ...prev,

        {

          id: activityId,

          role: "assistant",

          content: "",

          kind: "activity",

          activity: { title: `Running: ${cmd}`, status: "running", steps: [] },

        },

      ]);



      const pushStep = (msg: string) => {

        const t = msg.trim();

        if (!t) return;

        if (t.startsWith("terminal ")) {

          const clean = stripAnsiForLog(t.slice("terminal ".length));

          if (!clean.trim()) return;

          // Basic filtering of spinners / noisy progress glyphs.

          if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]+$/.test(clean.trim())) return;

          appendActivityStep(activityId, clean, { detail: true });

          tail.push(clean);

          if (tail.length > 80) tail.splice(0, tail.length - 80);

          return;

        }

      };



      try {

        await runTerminalCommand(cmd, pushStep);

        await refreshWorkspaceAfterRun();



        const joined = tail.join("\n");

        const looksFailed =

          /\bnpm\s+err!/i.test(joined) ||

          /\berror\s+enoent\b/i.test(joined) ||

          /\bcommand failed\b/i.test(joined) ||

          /\b(exit code|code)\b\s*[:=]?\s*[1-9]/i.test(joined);



        setActiveChatMessages((prev) =>

          prev.map((m) => (m.id === messageId ? { ...m, run: m.run ? { ...m.run, status: "done" } : m.run } : m))

        );

        setActivityStatus(activityId, "done");



        if (looksFailed) {

          const err = tail.slice(-20).join("\n");

          setActiveChatMessages((prev) =>

            prev.map((m) =>

              m.id === messageId

                ? {

                    ...m,

                    run: m.run

                      ? {

                          ...m.run,

                          error: err || "Command appears to have failed.",

                          tail: tail.slice(-80),

                        }

                      : m.run,

                  }

                : m

            )

          );



          addLog({ kind: "error", title: "Run failed", status: "error", details: ["Click Fix to ask AI to resolve it."] });



          const currentAfter = (chatMessagesRef.current ?? []).find((m) => m.id === messageId);

          const already = Boolean(currentAfter?.run?.autoFixRequested);

          if (!already) {

            setActiveChatMessages((prev) =>

              prev.map((m) =>

                m.id === messageId

                  ? {

                      ...m,

                      run: m.run ? { ...m.run, autoFixRequested: true } : m.run,

                    }

                  : m

              )

            );

            window.setTimeout(() => {

              void askAiToFixRunError(messageId);

            }, 250);

          }

        } else {

          setActiveChatMessages((prev) =>

            prev.map((m) => (m.id === messageId ? { ...m, run: m.run ? { ...m.run, tail: tail.slice(-80) } : m.run } : m))

          );

        }



        const next = remaining[0] ?? "";

        const rest = remaining.slice(1);

        if (next.trim()) {

          if (runPolicy === "always") {

            pushRunRequest(next, rest);

            window.setTimeout(() => {

              const last = (chatMessagesRef.current ?? [])

                .slice()

                .reverse()

                .find((m) => m.kind === "run_request" && m.run?.cmd === next);

              if (last?.id) void runFromRunCard(last.id, "once");

            }, 0);

          } else {

            pushRunRequest(next, rest);

          }

        }

      } catch (e) {

        appendActivityStep(activityId, `Command failed: ${String(e)}`);

        setActivityStatus(activityId, "error");

        setActiveChatMessages((prev) =>

          prev.map((m) => (m.id === messageId ? { ...m, run: m.run ? { ...m.run, status: "canceled" } : m.run } : m))

        );

      }

    },

    [addLog, appendActivityStep, askAiToFixRunError, pushRunRequest, refreshWorkspaceAfterRun, runPolicy, runTerminalCommand, setActiveChatMessages, setActivityStatus]

  );



  const cancelRunCard = useCallback(

    (messageId: string) => {

      setActiveChatMessages((prev) =>

        prev.map((m) => (m.id === messageId ? { ...m, run: m.run ? { ...m.run, status: "canceled", remaining: [] } : m.run } : m))

      );

    },

    [setActiveChatMessages]

  );



  const applyAiEditsNow = useCallback(

    async (

      edits: AiEditOp[],

      onStep?: (msg: string) => void,

      opts?: { pace?: boolean; previewFile?: (path: string) => Promise<void> }

    ) => {

      if (!edits.length) return;

      if (!workspace.root) throw new Error("No workspace is open");



      const queuedRuns: string[] = [];



      const wait = async (ms: number) => {

        if (!ms) return;

        await new Promise<void>((r) => window.setTimeout(r, ms));

      };



      const revealMsForText = (text: string) => {

        const segs = text.match(/\S+\s*/g);

        const n = segs ? segs.length : Math.max(1, Math.ceil(text.length / 6));

        const step = text.length > 20000 ? 18 : 10;

        const ticks = Math.ceil(n / step);

        return clamp(ticks * 28, 240, 2400);

      };



      const overwrites = edits.filter((e) => {

        const op = (e.op || "").toLowerCase();

        return (op === "write" || op === "patch") && typeof e.path === "string";

      });

      if (overwrites.length) {

        const dirtyConflicts = overwrites

          .map((w) => w.path!)

          .filter((p) => tabs.some((t) => t.path === p && t.isDirty));

        void dirtyConflicts;

      }



      const refreshTargets = new Set<string>();

      const queuedRunSet = new Set<string>();

      for (const e of edits) {

        const op = (e.op || "").toLowerCase();



        if (op === "write") {

          const p = e.path?.trim();

          if (!p) throw new Error("AI edit op 'write' missing path");

          onStep?.(`editing ${p}`);

          if (opts?.previewFile) await opts.previewFile(p);

          if (opts?.pace) await wait(revealMsForText(String(e.content ?? "")));

          let existing: string | null = null;

          try {

            existing = await workspaceReadFile(p);

          } catch {

            existing = null;

          }

          if (existing && existing.length > 2000) {

            const nextLen = (e.content ?? "").length;

            if (nextLen < existing.length * 0.3) {

              void nextLen;

            }

          }

          await workspaceWriteFile(p, e.content ?? "");

          const parent = p.includes("/") ? p.split("/").slice(0, -1).join("/") : "";

          refreshTargets.add(parent);

          setFileIndexRoot(null);

          setFileIndex([]);

          setTabs((prev) => prev.map((t) => (t.path === p ? { ...t, content: e.content ?? "", isDirty: false } : t)));

          onStep?.(`write ${p}`);

          if (opts?.pace) await wait(120);

        } else if (op === "patch") {

          const p = e.path?.trim();

          if (!p) throw new Error("AI edit op 'patch' missing path");

          const patchText = String(e.content ?? "");

          let beforeResolved = "";

          try {

            const r = await workspaceReadFile(p);

            beforeResolved = typeof r === "string" ? r : (r as { content?: string }).content ?? "";

          } catch {

            beforeResolved = "";

          }



          const res = applyUnifiedDiffToText(beforeResolved, patchText);

          if (!res.ok) throw new Error(`Failed to apply patch to ${p}: ${res.error}`);

          onStep?.(`editing ${p}`);

          if (opts?.previewFile) await opts.previewFile(p);

          if (opts?.pace) await wait(revealMsForText(res.text));

          await workspaceWriteFile(p, res.text);

          const parent = p.includes("/") ? p.split("/").slice(0, -1).join("/") : "";

          refreshTargets.add(parent);

          setFileIndexRoot(null);

          setFileIndex([]);

          setTabs((prev) => prev.map((t) => (t.path === p ? { ...t, content: res.text, isDirty: false } : t)));

          onStep?.(`patch ${p}`);

          if (opts?.pace) await wait(120);

        } else if (op === "delete") {

          const p = e.path?.trim();

          if (!p) throw new Error("AI edit op 'delete' missing path");

          await workspaceDelete(p);

          const parent = p.includes("/") ? p.split("/").slice(0, -1).join("/") : "";

          refreshTargets.add(parent);

          setFileIndexRoot(null);

          setFileIndex([]);

          setTabs((prev) => prev.filter((t) => t.path !== p));

          if (activeTabPath === p) setActiveTabPath(null);

          onStep?.(`delete ${p}`);

          if (opts?.pace) await wait(160);

        } else if (op === "rename") {

          const from = e.from?.trim();

          const to = e.to?.trim();

          if (!from || !to) throw new Error("AI edit op 'rename' missing from/to");

          await workspaceRename(from, to);

          const fromParent = from.includes("/") ? from.split("/").slice(0, -1).join("/") : "";

          const toParent = to.includes("/") ? to.split("/").slice(0, -1).join("/") : "";

          refreshTargets.add(fromParent);

          refreshTargets.add(toParent);

          setFileIndexRoot(null);

          setFileIndex([]);

          setTabs((prev) => prev.map((t) => (t.path === from ? { ...t, path: to, name: basename(to), language: detectLanguage(to) } : t)));

          if (activeTabPath === from) setActiveTabPath(to);

          onStep?.(`rename ${from} → ${to}`);

          if (opts?.pace) await wait(160);

        } else if (op === "run") {

          const cmd = String(e.content ?? "").trim();

          if (!cmd) throw new Error("AI edit op 'run' missing command in content");

          if (!queuedRunSet.has(cmd)) {

            queuedRunSet.add(cmd);

            queuedRuns.push(cmd);

            onStep?.(`run ${cmd}`);

          }

        } else {

          throw new Error(`Unsupported AI edit op: ${e.op}`);

        }

      }



      await refreshDirRef.current?.(undefined);

      for (const dir of refreshTargets) await refreshDirRef.current?.(dir || undefined);



      if (queuedRuns.length) {

        if (runPolicy === "always") {

          // Still show per-command cards, but auto-run them.

          pushRunRequest(queuedRuns[0]!, queuedRuns.slice(1));

          window.setTimeout(() => {

            const last = (chatMessagesRef.current ?? []).slice().reverse().find((m) => m.kind === "run_request" && m.run?.cmd === queuedRuns[0]);

            if (last?.id) void runFromRunCard(last.id, "once");

          }, 0);

        } else {

          pushRunRequest(queuedRuns[0]!, queuedRuns.slice(1));

        }

      }

    },

    [activeTabPath, pushRunRequest, runFromRunCard, runPolicy, tabs, workspace.root]

  );



  const buildChangeSet = useCallback(

    async (edits: AiEditOp[]): Promise<ChangeSet> => {

      const files: ChangeFile[] = [];

      const seen = new Set<string>();



      const readBefore = async (p: string): Promise<string | null> => {

        const open = tabs.find((t) => t.path === p);

        if (open) return open.content;

        try {

          const r = await workspaceReadFile(p);

          return typeof r === "string" ? r : (r as { content?: string }).content ?? "";

        } catch {

          return null;

        }

      };



      for (const e of edits) {

        const op = (e.op || "").toLowerCase();



        if (op === "run") {

          continue;

        }



        if (op === "write") {

          const p = e.path?.trim();

          if (!p) continue;

          if (seen.has(`w:${p}`)) continue;

          seen.add(`w:${p}`);

          const before = await readBefore(p);

          const after = typeof e.content === "string" ? e.content : "";

          files.push({ kind: "write", path: p, before, after });

        } else if (op === "patch") {

          const p = e.path?.trim();

          if (!p) continue;

          if (seen.has(`p:${p}`)) continue;

          seen.add(`p:${p}`);

          const before = (await readBefore(p)) ?? "";

          const patchText = String(e.content ?? "");

          const res = applyUnifiedDiffToText(before, patchText);

          if (!res.ok) throw new Error(`Failed to build changeset patch for ${p}: ${res.error}`);

          files.push({ kind: "write", path: p, before, after: res.text });

        } else if (op === "delete") {

          const p = e.path?.trim();

          if (!p) continue;

          if (seen.has(`d:${p}`)) continue;

          seen.add(`d:${p}`);

          const before = await readBefore(p);

          files.push({ kind: "delete", path: p, before, after: null });

        } else if (op === "rename") {

          const from = e.from?.trim();

          const to = e.to?.trim();

          if (!from || !to) continue;

          if (seen.has(`r:${from}->${to}`)) continue;

          seen.add(`r:${from}->${to}`);

          const before = await readBefore(from);

          const after = before;

          files.push({ kind: "rename", path: `${from} → ${to}`, before, after });

        }

      }



      const stats = computeStats(files);

      return {

        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,

        edits,

        files,

        stats,

        applied: false,

      };

    },

    [tabs]

  );



  const confirmApplyChangeSet = useCallback(

    async (cs: ChangeSet): Promise<boolean> => {

      const writeFiles = cs.files.filter((f) => f.kind === "write");

      const deletes = cs.files.filter((f) => f.kind === "delete");

      const renames = cs.files.filter((f) => f.kind === "rename");

      const newFiles = writeFiles.filter((f) => f.before === null);



      const reasons: string[] = [];

      if (cs.files.length > 8) reasons.push(`Large change: ${cs.files.length} files`);

      if (newFiles.length) reasons.push(`Creates new files: ${newFiles.length}`);

      if (deletes.length) reasons.push(`Deletes files: ${deletes.length}`);

      if (renames.length) reasons.push(`Renames: ${renames.length}`);



      if (!reasons.length) return true;

      return await requestConfirm(

        "Apply change set",

        `This change set is larger than usual or potentially destructive:\n\n- ${reasons.join("\n- ")}\n\nApply anyway?`,

        { danger: true, confirmLabel: "Apply" }

      );

    },

    [requestConfirm]

  );



  const notify = useCallback(

    (n: Omit<AppNotification, "id">) => {

      if (n.kind !== "error") return;

      const line = `${n.title}: ${n.message}`.trim();

      if (!line) return;

      enqueueMetaLine(line);

    },

    [enqueueMetaLine]

  );



  useEffect(() => {

    notifyRef.current = notify;

  }, [notify]);



  const friendlyAiError = useCallback((raw: string): { title: string; message: string } => {

    const msg = raw.trim();



    if (/\bout_of_credits\b/i.test(msg)) {

      return {

        title: "Pompora: out of credits",

        message: "You ran out of credits for this mode. Upgrade your plan or wait for the quota reset.",

      };

    }



    if (/\bno_fast_access\b/i.test(msg)) {

      return {

        title: "Pompora: fast not available",

        message: "Your current plan does not include fast mode. Upgrade your plan or use slow mode.",

      };

    }



    if (/openrouter_rate_limited/i.test(msg)) {

      return {

        title: "OpenRouter: rate limited",

        message: "OpenRouter rate limited the upstream request (shared free capacity). Wait a bit or switch to a different model/provider.",

      };

    }



    if (/openrouter_privacy_block/i.test(msg) || /Free model publication/i.test(msg)) {

      return {

        title: "OpenRouter: privacy settings",

        message:

          "OpenRouter blocked the request due to your privacy/data-policy settings for free models (\"Free model publication\"). Open https://openrouter.ai/settings/privacy and relax the restriction (or use a non-free model / BYOK).",

      };

    }



    if (msg.includes("Insufficient Balance") || msg.includes("status 402") || msg.includes("Payment Required")) {

      const mentionsDeepSeek = /deepseek/i.test(msg);

      return {

        title: mentionsDeepSeek ? "DeepSeek: Payment required" : "AI: Payment required",

        message: mentionsDeepSeek

          ? "Your DeepSeek API key has insufficient balance. Add credits / enable billing in DeepSeek or switch to another provider."

          : "This provider requires billing/credits for the selected upstream route. Switch provider/model or wait and retry if this is coming from OpenRouter shared capacity.",

      };

    }



    const m = msg.match(/status\s+(\d+)/i);

    const status = m ? Number(m[1]) : null;

    if (status === 401 || status === 403) {

      return {

        title: "AI: Authorization failed",

        message: "Your API key is invalid or missing permissions. Re-check the key for the selected provider.",

      };

    }

    if (status === 429) {

      return { title: "AI: Rate limited", message: "You are being rate limited. Wait a bit and try again." };

    }



    return { title: "AI request failed", message: msg };

  }, []);



  const [explorerMenu, setExplorerMenu] = useState<{

    x: number;

    y: number;

    path: string;

    isDir: boolean;

  } | null>(null);



  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);

  const cursorListenerDisposeRef = useRef<{ dispose: () => void } | null>(null);

  const editorKeydownDisposeRef = useRef<{ dispose: () => void } | null>(null);

  const [cursorPos, setCursorPos] = useState<{ line: number; col: number } | null>(null);

  const activeTab = useMemo(

    () => (activeTabPath ? tabs.find((t) => t.path === activeTabPath) ?? null : null),

    [activeTabPath, tabs]

  );



  useEffect(() => {

    return () => {

      editorKeydownDisposeRef.current?.dispose();

      editorKeydownDisposeRef.current = null;

    };

  }, []);



  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const [imageScale, setImageScale] = useState(1);

  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const imageDragRef = useRef<{ pointerId: number | null; startX: number; startY: number; baseX: number; baseY: number }>({

    pointerId: null,

    startX: 0,

    startY: 0,

    baseX: 0,

    baseY: 0,

  });

  const lastImageAutoFitKeyRef = useRef<string>("");



  useEffect(() => {

    if (activeTab?.kind !== "image") return;

    setImageNaturalSize(null);

    setImageScale(1);

    setImageOffset({ x: 0, y: 0 });

  }, [activeTab?.kind, activeTab?.path]);



  useEffect(() => {

    if (activeTab?.kind !== "image") return;

    const url = activeTab.image?.url;

    if (!url) return;

    let alive = true;

    const img = new Image();

    img.onload = () => {

      if (!alive) return;

      const w = img.naturalWidth || img.width || 0;

      const h = img.naturalHeight || img.height || 0;

      if (!w || !h) return;

      setImageNaturalSize({ w, h });

    };

    img.src = url;

    return () => {

      alive = false;

    };

  }, [activeTab?.kind, activeTab?.image?.url]);



  const clampScale = useCallback((s: number) => Math.max(0.05, Math.min(40, s)), []);



  const setScaleAroundPoint = useCallback(

    (nextScaleRaw: number, cx: number, cy: number) => {

      const nextScale = clampScale(nextScaleRaw);

      const prevScale = imageScale;

      if (!prevScale || !Number.isFinite(prevScale)) return;

      const wx = (cx - imageOffset.x) / prevScale;

      const wy = (cy - imageOffset.y) / prevScale;

      const nextX = cx - wx * nextScale;

      const nextY = cy - wy * nextScale;

      setImageScale(nextScale);

      setImageOffset({ x: nextX, y: nextY });

    },

    [clampScale, imageOffset.x, imageOffset.y, imageScale]

  );



  const fitImageToView = useCallback(() => {

    if (activeTab?.kind !== "image") return;

    const el = imageContainerRef.current;

    if (!el) return;

    if (!imageNaturalSize) return;

    const rect = el.getBoundingClientRect();

    const cw = Math.max(1, rect.width);

    const ch = Math.max(1, rect.height);

    const pad = 16;

    const sx = (cw - pad) / imageNaturalSize.w;

    const sy = (ch - pad) / imageNaturalSize.h;

    const s = clampScale(Math.min(sx, sy));

    const x = (cw - imageNaturalSize.w * s) / 2;

    const y = (ch - imageNaturalSize.h * s) / 2;

    setImageScale(s);

    setImageOffset({ x, y });

  }, [activeTab?.kind, clampScale, imageNaturalSize]);



  useEffect(() => {

    if (activeTab?.kind !== "image") return;

    if (!imageNaturalSize) return;

    const key = `${activeTab.path}:${activeTab.image?.url ?? ""}:${imageNaturalSize.w}x${imageNaturalSize.h}`;

    if (lastImageAutoFitKeyRef.current === key) return;

    lastImageAutoFitKeyRef.current = key;

    fitImageToView();

  }, [activeTab?.kind, activeTab?.image?.url, activeTab?.path, fitImageToView, imageNaturalSize]);



  const zoomImage = useCallback(

    (mult: number) => {

      if (activeTab?.kind !== "image") return;

      const el = imageContainerRef.current;

      if (!el) return;

      const rect = el.getBoundingClientRect();

      const cx = rect.width / 2;

      const cy = rect.height / 2;

      setScaleAroundPoint(imageScale * mult, cx, cy);

    },

    [activeTab?.kind, imageScale, setScaleAroundPoint]

  );



  const resetImageView = useCallback(() => {

    setImageScale(1);

    setImageOffset({ x: 0, y: 0 });

  }, []);



  const onImageWheel = useCallback(

    (e: React.WheelEvent) => {

      if (activeTab?.kind !== "image") return;

      const el = imageContainerRef.current;

      if (!el) return;

      e.preventDefault();

      const rect = el.getBoundingClientRect();

      const cx = e.clientX - rect.left;

      const cy = e.clientY - rect.top;

      const factor = Math.exp(-e.deltaY * 0.0015);

      setScaleAroundPoint(imageScale * factor, cx, cy);

    },

    [activeTab?.kind, imageScale, setScaleAroundPoint]

  );



  const onImagePointerDown = useCallback(

    (e: React.PointerEvent) => {

      if (activeTab?.kind !== "image") return;

      if (e.button !== 0) return;

      const el = imageContainerRef.current;

      if (!el) return;

      try {

        el.setPointerCapture(e.pointerId);

      } catch {

      }

      imageDragRef.current.pointerId = e.pointerId;

      imageDragRef.current.startX = e.clientX;

      imageDragRef.current.startY = e.clientY;

      imageDragRef.current.baseX = imageOffset.x;

      imageDragRef.current.baseY = imageOffset.y;

    },

    [activeTab?.kind, imageOffset.x, imageOffset.y]

  );



  const onImagePointerMove = useCallback(

    (e: React.PointerEvent) => {

      if (activeTab?.kind !== "image") return;

      if (imageDragRef.current.pointerId !== e.pointerId) return;

      const dx = e.clientX - imageDragRef.current.startX;

      const dy = e.clientY - imageDragRef.current.startY;

      setImageOffset({ x: imageDragRef.current.baseX + dx, y: imageDragRef.current.baseY + dy });

    },

    [activeTab?.kind]

  );



  const onImagePointerUp = useCallback(

    (e: React.PointerEvent) => {

      if (imageDragRef.current.pointerId !== e.pointerId) return;

      imageDragRef.current.pointerId = null;

    },

    []

  );



  const activeTabChangeFile = useMemo(() => {

    if (!activeTab) return null;

    const cs = activeChat.changeSet;

    if (!cs) return null;

    const f = cs.files.find((x) => x.kind === "write" && x.path === activeTab.path);

    return f ?? null;

  }, [activeChat.changeSet, activeTab]);



  const [typedEditorText, setTypedEditorText] = useState<string | null>(null);

  const editorTypingTimerRef = useRef<number | null>(null);

  const lastEditorTypingKeyRef = useRef<string>("");



  useEffect(() => {

    return () => {

      if (editorTypingTimerRef.current) window.clearInterval(editorTypingTimerRef.current);

      editorTypingTimerRef.current = null;

    };

  }, []);



  useEffect(() => {

    const csId = activeChat.changeSet?.id ?? "";

    const p = activeTab?.path ?? "";

    const full = typeof activeTabChangeFile?.after === "string" ? activeTabChangeFile.after : null;



    if (!csId || !p || full === null) {

      setTypedEditorText(null);

      lastEditorTypingKeyRef.current = "";

      if (editorTypingTimerRef.current) window.clearInterval(editorTypingTimerRef.current);

      editorTypingTimerRef.current = null;

      return;

    }



    const key = `${csId}:${p}:${full.length}:${full.slice(0, 32)}`;

    if (lastEditorTypingKeyRef.current === key) return;

    lastEditorTypingKeyRef.current = key;



    if (full.length < 140) {

      setTypedEditorText(null);

      if (editorTypingTimerRef.current) window.clearInterval(editorTypingTimerRef.current);

      editorTypingTimerRef.current = null;

      return;

    }



    if (editorTypingTimerRef.current) window.clearInterval(editorTypingTimerRef.current);

    editorTypingTimerRef.current = null;



    setTypedEditorText("");



    const segments = full.match(/\S+\s*/g) ?? [full];

    const step = full.length > 20000 ? 18 : 10;

    let i = 0;



    editorTypingTimerRef.current = window.setInterval(() => {

      i = Math.min(segments.length, i + step);

      setTypedEditorText(segments.slice(0, i).join(""));

      if (i >= segments.length) {

        if (editorTypingTimerRef.current) window.clearInterval(editorTypingTimerRef.current);

        editorTypingTimerRef.current = null;

      }

    }, 28);

  }, [activeChat.changeSet?.id, activeTab?.path, activeTabChangeFile?.after]);



  useEffect(() => {

    try {

      const raw = window.localStorage.getItem("pompora.recentFiles");

      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {

        setRecentFiles(parsed.filter((x) => typeof x === "string").slice(0, 20));

      }

    } catch {

      // ignore

    }

  }, []);



  const rememberRecentFile = useCallback((absPath: string) => {

    const norm = absPath.replace(/\\/g, "/");

    setRecentFiles((prev) => {

      const next = [norm, ...prev.filter((p) => p !== norm)].slice(0, 20);

      try {

        window.localStorage.setItem("pompora.recentFiles", JSON.stringify(next));

      } catch {

        // ignore

      }

      return next;

    });

  }, []);



  const openNewWindow = useCallback(() => {

    try {

      const label = `main-${Date.now()}`;

      // In dev, this will load the devUrl; in production it loads the bundled index.

      const url = window.location.origin;

      new WebviewWindow(label, { title: "Pompora", width: 1280, height: 800, url });

    } catch (e) {

      devConsoleError("New window failed", e);

      notify({ kind: "error", title: "New window", message: `Failed to open new window: ${String(e)}` });

    }

  }, [devConsoleError, notify]);



  useEffect(() => {

    const root = document.documentElement;

    if (settings.theme === "light") root.setAttribute("data-theme", "light");

    else root.removeAttribute("data-theme");

  }, [settings.theme]);



  useEffect(() => {

    let cancelled = false;

    Promise.all([settingsGet(), workspaceGet()])

      .then(([s, w]) => {

        if (cancelled) return;

        const migratedProvider = s.active_provider === "openrouter" ? "openai" : s.active_provider;

        setSettingsState((prev) => ({

          ...prev,

          ...s,

          pompora_thinking: (s as AppSettings).pompora_thinking ?? prev.pompora_thinking ?? null,

          editor_cursor_blinking: (s as AppSettings).editor_cursor_blinking ?? prev.editor_cursor_blinking ?? "expand",

          editor_line_highlight_color: (s as AppSettings).editor_line_highlight_color ?? prev.editor_line_highlight_color ?? null,

          editor_cursor_color: (s as AppSettings).editor_cursor_color ?? prev.editor_cursor_color ?? null,

          keybindings: { ...DEFAULT_KEYBINDINGS, ...((s as AppSettings).keybindings ?? {}) },

          workspace_root: s.workspace_root ?? null,

          recent_workspaces: s.recent_workspaces ?? [],

          active_provider: migratedProvider ?? null,

        }));

        setWorkspaceState(w);

      })

      .catch(() => {

        if (cancelled) return;

      })

      .finally(() => {

        if (cancelled) return;

        setIsSettingsLoaded(true);

      });



    return () => {

      cancelled = true;

    };

  }, []);



  useEffect(() => {

    let cancelled = false;

    setSecretsError(null);

    setKeyStatus(null);



    if (!isSettingsLoaded) return;

    if (!settings.active_provider) return;



    providerKeyStatus(settings.active_provider)

      .then((v) => {

        if (cancelled) return;

        setKeyStatus(v);

      })

      .catch((e: unknown) => {

        if (cancelled) return;

        setSecretsError(String(e));

      });



    return () => {

      cancelled = true;

    };

  }, [isSettingsLoaded, settings.active_provider]);



  useEffect(() => {

    let cancelled = false;

    authGetProfile()

      .then((p) => {

        if (cancelled) return;

        setAuthProfile(p);

      })

      .catch((e: unknown) => {

        devConsoleError("authGetProfile failed", e);

      });

    return () => {

      cancelled = true;

    };

  }, []);



  useEffect(() => {

    if (!authProfile) {

      setAuthCredits(null);

      return;

    }

    let cancelled = false;

    authGetCredits()

      .then((c) => {

        if (cancelled) return;

        setAuthCredits(c);

      })

      .catch((e: unknown) => {

        devConsoleError("authGetCredits failed", e);

      });

    return () => {

      cancelled = true;

    };

  }, [authProfile]);



  useEffect(() => {

    if (!isAccountMenuOpen) return;

    const onDown = (e: MouseEvent) => {

      const t = e.target as HTMLElement | null;

      if (!t) return;

      if (!t.closest("[data-account-menu-root]")) setIsAccountMenuOpen(false);

    };

    window.addEventListener("mousedown", onDown);

    return () => window.removeEventListener("mousedown", onDown);

  }, [isAccountMenuOpen]);



  const avatarLetter = useMemo(() => {

    const first = (authProfile?.first_name ?? "").trim();

    const last = (authProfile?.last_name ?? "").trim();

    if (first && last) return `${first[0]!.toUpperCase()}${last[0]!.toUpperCase()}`;

    if (first) return first[0]!.toUpperCase();

    const email = (authProfile?.email ?? "").trim();

    if (email) return email[0]!.toUpperCase();

    return "U";

  }, [authProfile?.email, authProfile?.first_name, authProfile?.last_name]);



  const [avatarImgError, setAvatarImgError] = useState(false);

  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);



  useEffect(() => {

    setAvatarImgError(false);

    setAvatarDataUrl(null);

  }, [authProfile?.avatar_url]);



  useEffect(() => {

    const url = (authProfile?.avatar_url ?? "").trim();

    if (!url) return;

    let cancelled = false;

    authAvatarDataUrl(url)

      .then((d: string) => {

        if (cancelled) return;

        const next = String(d || "").trim();

        if (next) setAvatarDataUrl(next);

      })

      .catch((e: unknown) => {

        if (cancelled) return;

        devConsoleError("authAvatarDataUrl failed", e);

      });

    return () => {

      cancelled = true;

    };

  }, [authProfile?.avatar_url, devConsoleError]);



  const safeOpenUrl = useCallback(async (url: string) => {

    try {

      const attempt = openUrl(url);

      const result = await Promise.race([

        attempt

          .then(() => "ok" as const)

          .catch(() => "err" as const),

        new Promise<"timeout">((resolve) => window.setTimeout(() => resolve("timeout"), 1500)),

      ]);

      if (result === "ok") return true;

    } catch {

    }

    try {

      window.open(url, "_blank", "noopener,noreferrer");

      return true;

    } catch {

    }

    return false;

  }, []);



  const logoutDesktop = useCallback(async () => {

    if (isAuthBusy) return;

    setIsAuthBusy(true);

    try {

      await authLogout();

      setAuthProfile(null);

      setAuthCredits(null);

      setIsAccountMenuOpen(false);

      try {

        if (settings.active_provider === "pompora") {

          setKeyStatus(await providerKeyStatus("pompora"));

        }

      } catch {

      }

    } catch (e) {

      notify({ kind: "error", title: "Logout failed", message: String(e) });

    } finally {

      setIsAuthBusy(false);

    }

  }, [isAuthBusy, notify, settings.active_provider]);



  const beginDesktopAuthWithMode = useCallback(

    async (mode: "login" | "signup") => {

      if (isAuthBusy) return;

      setIsAuthBusy(true);

      try {

        const [url, state] = await authBeginLogin();

        let target = url;

        try {

          const u = new URL(url);

          const redirectTo = u.searchParams.get("redirect") ?? "";

          const st = u.searchParams.get("state") ?? state;

          const next = `/desktop/login?redirect=${redirectTo}&state=${st}`;

          target = `https://pompora.dev/${mode}?next=${encodeURIComponent(next)}`;

        } catch {

        }



        notify({ kind: "info", title: "Sign in", message: "Opening browser…" });

        const ok = await safeOpenUrl(target);

        if (!ok) {

          notify({ kind: "error", title: "Could not open browser", message: "Copy the URL and open it manually." });

          await requestTextPrompt("Open this URL in your browser", target, { readOnly: true, showCopy: true });

          setIsAuthBusy(false);

          void authWaitLogin(state)

            .then(async (profile) => {

              setAuthProfile(profile);

              try {

                const credits = await authGetCredits();

                setAuthCredits(credits);

              } catch (e) {

                devConsoleError("authGetCredits failed (after login)", e);

              }

              try {

                if (settings.active_provider === "pompora") {

                  setKeyStatus(await providerKeyStatus("pompora"));

                }

              } catch {

              }

              notify({ kind: "info", title: "Signed in", message: "Connected to your Pompora account." });

            })

            .catch((e) => {

              notify({ kind: "error", title: "Sign in failed", message: String(e) });

            });

          return;

        }

        setIsAuthBusy(false);

        void authWaitLogin(state)

          .then(async (profile) => {

            setAuthProfile(profile);

            try {

              const credits = await authGetCredits();

              setAuthCredits(credits);

            } catch (e) {

              devConsoleError("authGetCredits failed (after login)", e);

            }

            try {

              if (settings.active_provider === "pompora") {

                setKeyStatus(await providerKeyStatus("pompora"));

              }

            } catch {

            }

            notify({ kind: "info", title: "Signed in", message: "Connected to your Pompora account." });

          })

          .catch((e) => {

            notify({ kind: "error", title: "Sign in failed", message: String(e) });

          });

      } catch (e) {

        notify({ kind: "error", title: "Sign in failed", message: String(e) });

      } finally {

        setIsAuthBusy(false);

      }

    },

    [authGetCredits, authWaitLogin, isAuthBusy, notify, safeOpenUrl, settings.active_provider]

  );



  // Additional effect to refresh key status and load models when showKeySaved is true

  useEffect(() => {

    if (showKeySaved && settings.active_provider) {

      const providerId = settings.active_provider;

      providerKeyStatus(providerId)

        .then(async (v) => {

          setKeyStatus(v);

          // Load models if key is now configured

          if (v.is_configured && providerId !== "pompora") {

            // Refresh key statuses first - use hardcoded list to avoid dependency issue

            const targets = ["openai", "anthropic", "gemini", "deepseek", "groq", "mistral", "together", "perplexity", "openrouter", "xai", "cohere", "custom", "pompora"];

            const out: Record<string, KeyStatus | null> = {};

            await Promise.all(

              targets.map(async (id) => {

                try {

                  out[id] = await providerKeyStatus(id);

                } catch {

                  out[id] = null;

                }

              })

            );

            setProviderKeyStatuses(out);

            

            // Then load models

            const providerId = settings.active_provider;

            if (providerId) {

              if (!loadingModels[providerId]) {

                setLoadingModels((prev) => ({ ...prev, [providerId]: true }));

                try {

                  const models = await providerListModels({

                    provider: providerId,

                    encryptionPassword: encryptionPasswordDraft || undefined,

                  });

                  setProviderModels((prev) => ({ ...prev, [providerId]: models }));

                } catch (e) {

                  console.warn(`Failed to load models for ${providerId}:`, e);

                } finally {

                  setLoadingModels((prev => {

                    const next = { ...prev };

                    delete next[providerId];

                    return next;

                  }));

                }

              }

            }

          }

        })

        .catch((e: unknown) => {

          setSecretsError(String(e));

        });

    }

  }, [showKeySaved, settings.active_provider, loadingModels, encryptionPasswordDraft]);



  const providerChoices = useMemo(

    () =>

      [

        { id: "pompora", label: "Pompora", api: false, category: "premium" },

        { id: "openai", label: "OpenAI", api: true, category: "cloud" },

        { id: "anthropic", label: "Anthropic", api: true, category: "cloud" },

        { id: "gemini", label: "Google Gemini", api: true, category: "cloud" },

        { id: "deepseek", label: "DeepSeek", api: true, category: "cloud" },

        { id: "groq", label: "Groq", api: true, category: "cloud" },

        { id: "mistral", label: "Mistral AI", api: true, category: "cloud" },

        { id: "together", label: "Together AI", api: true, category: "cloud" },

        { id: "perplexity", label: "Perplexity", api: true, category: "cloud" },

        { id: "openrouter", label: "OpenRouter", api: true, category: "cloud" },

        { id: "xai", label: "xAI (Grok)", api: true, category: "cloud" },

        { id: "cohere", label: "Cohere", api: true, category: "cloud" },

        { id: "ollama", label: "Ollama", api: false, category: "local" },

        { id: "lmstudio", label: "LM Studio", api: false, category: "local" },

        { id: "custom", label: "Custom Endpoint", api: true, category: "custom" },

      ] as const,

    []

  );



  const providerLabel = useMemo(() => {

    const p = settings.active_provider;

    if (!p) return "Not configured";

    if (p === "pompora") {

      const t = String(settings.pompora_thinking ?? uiPomporaThinking ?? "slow").toLowerCase();

      const label = t === "reasoning" ? "Reasoning" : t === "fast" ? "Fast" : "Slow";

      return `Pompora ${label}`;

    }

    const found = providerChoices.find((x) => x.id === p);

    const baseLabel = found?.label ?? p;

    if (settings.active_model) {

      const model = providerModels[p]?.find((m) => m.id === settings.active_model);

      const modelName = model?.name || settings.active_model;

      return `${baseLabel} • ${modelName}`;

    }

    return baseLabel;

  }, [providerChoices, settings.active_provider, settings.active_model, settings.pompora_thinking, uiPomporaThinking, providerModels]);



  const activeProviderMissingKey = useMemo(() => {

    const p = settings.active_provider;

    if (!p) return false;

    const choice = providerChoices.find((x) => x.id === p);

    if (!choice?.api) return false;

    const st = providerKeyStatuses[p];

    return st?.is_configured !== true;

  }, [providerChoices, providerKeyStatuses, settings.active_provider]);



  const providerNeedsKey = useMemo(() => {

    const p = settings.active_provider;

    if (!p) return true;

    if (p === "pompora") return false;

    // Local providers that don't need API keys

    return !["ollama", "lmstudio"].includes(p);

  }, [settings.active_provider]);



  const aiBlockedReason = useMemo(() => {

    if (settings.offline_mode) return "Offline mode is enabled";

    const p = settings.active_provider;

    if (!p) return "Pick an AI provider from the model dropdown";



    if (p === "pompora") {

      if (!authProfile) return "Sign in to unlock Pompora AI";

      if (keyStatus?.is_configured !== true) return "Finish signing in to Pompora";

      return null;

    }



    if (providerNeedsKey && keyStatus?.is_configured !== true) {

      return "Add an API key in Settings (Ctrl+,)";

    }



    return null;

  }, [authProfile, keyStatus?.is_configured, providerNeedsKey, settings.active_provider, settings.offline_mode]);



  const pomporaPlan = useMemo(() => {

    const raw = (authCredits?.plan || authProfile?.plan || "starter") as string;

    const p = String(raw || "starter").toLowerCase().trim();

    if (p === "pro_plus" || p === "proplus" || p === "pro+") return "pro";

    if (p === "free") return "starter";

    if (p === "starter" || p === "plus" || p === "pro") return p;

    return "starter";

  }, [authCredits?.plan, authProfile?.plan]);



  const pomporaAllowedModes = useMemo(() => {

    if (pomporaPlan === "pro") return ["slow", "fast", "reasoning"] as const;

    if (pomporaPlan === "plus") return ["slow", "fast"] as const;

    return ["slow"] as const;

  }, [pomporaPlan]);



  const pomporaAllowedModeSet = useMemo(() => new Set<string>(pomporaAllowedModes as readonly string[]), [pomporaAllowedModes]);



  const refreshProviderKeyStatuses = useCallback(async () => {

    const targets = [...providerChoices.filter((p) => p.api).map((p) => p.id), "pompora"];

    if (!targets.length) return;



    const out: Record<string, KeyStatus | null> = {};

    await Promise.all(

      targets.map(async (id) => {

        try {

          out[id] = await providerKeyStatus(id);

        } catch {

          out[id] = null;

        }

      })

    );

    setProviderKeyStatuses(out);

  }, [providerChoices]);



  const clearChatHistoryNow = useCallback(async () => {

    const ok = await requestConfirm("Delete chat history", "Delete all chat history? This cannot be undone.", { danger: true, confirmLabel: "Delete" });

    if (!ok) return;

    try {

      await historyClear();

    } catch {

    }

    const now = Date.now();

    const id = `${now}-${Math.random().toString(16).slice(2)}`;

    setChatSessions([{ id, title: "Chat", createdAt: now, updatedAt: now, messages: [], logs: [], draft: "", changeSet: null }]);

    setActiveChatId(id);

    notify({ kind: "info", title: "Privacy", message: "Chat history deleted" });

  }, [notify, requestConfirm]);



  const clearAllProviderKeysNow = useCallback(async () => {

    const ok = await requestConfirm("Delete API keys", "Delete all stored API keys? This cannot be undone.", { danger: true, confirmLabel: "Delete" });

    if (!ok) return;

    try {

      await providerKeysClearAll();

      await refreshProviderKeyStatuses();

      if (settings.active_provider) {

        try {

          setKeyStatus(await providerKeyStatus(settings.active_provider));

        } catch {

        }

      }

      notify({ kind: "info", title: "Privacy", message: "API keys deleted" });

    } catch (e) {

      devConsoleError(e);

      notify({ kind: "error", title: "Privacy", message: "Failed to delete API keys" });

    }

  }, [devConsoleError, notify, refreshProviderKeyStatuses, requestConfirm, settings.active_provider]);



  const clearAuthNow = useCallback(async () => {

    const ok = await requestConfirm(

      "Log out",

      "Delete local account info and log out? This does not delete your cloud account.",

      { danger: true, confirmLabel: "Log out" }

    );

    if (!ok) return;

    try {

      await authClear();

    } catch {

    }

    setAuthProfile(null);

    setAuthCredits(null);

    notify({ kind: "info", title: "Privacy", message: "Local account info deleted" });

  }, [notify, requestConfirm]);



  const clearSettingsFileNow = useCallback(async () => {

    const ok = await requestConfirm("Reset settings", "Reset settings to defaults? This cannot be undone.", { danger: true, confirmLabel: "Reset" });

    if (!ok) return;

    try {

      await settingsClear();

    } catch {

    }

    try {

      const s = await settingsGet();

      setSettingsState({

        theme: s.theme === "light" ? "light" : "dark",

        offline_mode: !!s.offline_mode,

        active_provider: s.active_provider ?? null,

        active_model: (s as any).active_model ?? null,

        pompora_thinking: (s as any).pompora_thinking ?? null,

        editor_cursor_blinking: (s as any).editor_cursor_blinking ?? "expand",

        editor_line_highlight_color: (s as any).editor_line_highlight_color ?? null,

        editor_cursor_color: (s as any).editor_cursor_color ?? null,

        keybindings: (s as any).keybindings ?? DEFAULT_KEYBINDINGS,

        workspace_root: (s as any).workspace_root ?? null,

        recent_workspaces: (s as any).recent_workspaces ?? [],

      } as any);

    } catch {

    }

    notify({ kind: "info", title: "Privacy", message: "Settings reset" });

  }, [notify, requestConfirm]);



  const wipeAllNow = useCallback(async () => {

    const ok = await requestConfirm(

      "Wipe all local data",

      "Wipe ALL local Pompora data (settings, history, keys, auth)? This cannot be undone.",

      { danger: true, confirmLabel: "Wipe" }

    );

    if (!ok) return;

    try {

      await appWipeAll();

    } catch {

    }



    setAuthProfile(null);

    setAuthCredits(null);

    setApiKeyDraft("");

    setEncryptionPasswordDraft("");

    setSecretsError(null);

    setProviderKeyStatuses({});

    setKeyStatus(null);



    const now = Date.now();

    const id = `${now}-${Math.random().toString(16).slice(2)}`;

    setChatSessions([{ id, title: "Chat", createdAt: now, updatedAt: now, messages: [], logs: [], draft: "", changeSet: null }]);

    setActiveChatId(id);



    setSettingsState({

      theme: "dark",

      offline_mode: false,

      active_provider: null,

      active_model: null,

      pompora_thinking: null,

      editor_cursor_blinking: "expand",

      editor_line_highlight_color: null,

      editor_cursor_color: null,

      keybindings: DEFAULT_KEYBINDINGS,

      workspace_root: null,

      recent_workspaces: [],

    });



    notify({ kind: "info", title: "Privacy", message: "All local data wiped" });

  }, [notify, requestConfirm]);



  const loadProviderModels = useCallback(async (providerId: string) => {

    // Don't reload if already loading, but allow reloading if models exist (in case key was updated)

    if (loadingModels[providerId]) {

      return;

    }

    

    setLoadingModels((prev) => ({ ...prev, [providerId]: true }));

    try {

      const models = await providerListModels({

        provider: providerId,

        encryptionPassword: encryptionPasswordDraft || undefined,

      });

      setProviderModels((prev) => ({ ...prev, [providerId]: models }));

    } catch (e) {

      // Silently fail - provider might not support model listing or key not configured

      console.warn(`Failed to load models for ${providerId}:`, e);

      const errText = shortAiProviderErr(formatErr(e));

      notify({

        kind: "error",

        title: "Models",

        message: `Failed to load models for ${providerId}: ${errText}`,

      });

      setProviderModelsError((prev) => ({ ...prev, [providerId]: errText }));

      // Clear models if loading failed (might be invalid key)

      setProviderModels((prev) => {

        const next = { ...prev };

        delete next[providerId];

        return next;

      });

    } finally {

      setLoadingModels((prev => {

        const next = { ...prev };

        delete next[providerId];

        return next;

      }));

    }

  }, [loadingModels, encryptionPasswordDraft, formatErr, notify, shortAiProviderErr]);





  const chatContextUsage = useMemo(() => {

    return { used: 0, total: 0, pct: 0 };

  }, []);



  const SETTINGS_TAB_PATH = "pompora:settings";



  const openSettingsTab = useCallback(() => {

    setTabs((prev) => {

      if (prev.some((t) => t.path === SETTINGS_TAB_PATH)) return prev;

      return [...prev, { path: SETTINGS_TAB_PATH, name: "Settings", language: "plaintext", content: "", isDirty: false }];

    });

    setActiveTabPath(SETTINGS_TAB_PATH);

  }, []);



  const [wsTooltip, setWsTooltip] = useState<{

    text: string;

    x: number;

    y: number;

    align: "tl" | "tr";

    placement: "above" | "below";

  } | null>(null);



  const showTooltipForEl = useCallback((el: HTMLElement | null, text: string, align: "tl" | "tr" = "tr") => {

    if (!el) return;

    const r = el.getBoundingClientRect();

    const pad = 10;

    const safeAlign: "tl" | "tr" = align === "tr" && r.right < 280 ? "tl" : align;



    const placement: "above" | "below" = r.top < 44 ? "below" : "above";



    // Anchor near the hovered element but keep the tooltip fully in-viewport.

    const anchorX = safeAlign === "tr" ? r.right : r.left;

    const anchorY = placement === "above" ? r.top : r.bottom;

    const x = Math.min(window.innerWidth - pad, Math.max(pad, anchorX));

    const y = Math.min(window.innerHeight - pad, Math.max(pad, anchorY));

    setWsTooltip({ text, x, y, align: safeAlign, placement });

  }, []);



  const hideTooltip = useCallback(() => setWsTooltip(null), []);



  useEffect(() => {

    if (!isModelPickerOpen) return;

    const onDown = (e: MouseEvent) => {

      const t = e.target as HTMLElement | null;

      if (!t) return;

      // Don't close if clicking inside the model picker

      if (t.closest("[data-model-picker-root]")) return;

      setIsModelPickerOpen(false);

    };

    window.addEventListener("mousedown", onDown);

    return () => window.removeEventListener("mousedown", onDown);

  }, [isModelPickerOpen]);



  // Effect to clear error when changing providers

  useEffect(() => {

    setSecretsError(null);

  }, [settings.active_provider]);



  const workspaceLabel = useMemo(() => {

    const root = workspace.root ?? settings.workspace_root;

    if (!root) return "No folder";

    return basename(root);

  }, [settings.workspace_root, workspace.root]);



  const footerRelPath = useMemo(() => {

    if (!workspace.root) return null;

    const p = activeTab?.path ?? null;

    if (!p) return null;

    if (p.startsWith("pompora:") || p.startsWith("untitled:")) return activeTab?.name ?? p;

    return p;

  }, [activeTab?.name, activeTab?.path, workspace.root]);



  const footerFileIconPath = useMemo(() => {

    if (!workspace.root) return null;

    const p = activeTab?.path ?? null;

    if (!p) return null;

    return p;

  }, [activeTab?.path, workspace.root]);



  useEffect(() => {

    setFooterPathExpanded(false);

  }, [footerRelPath, workspace.root]);



  const canUseAi = useMemo(() => {

    return aiBlockedReason === null;

  }, [aiBlockedReason]);



  const refreshDir = useCallback(async (relDir?: string) => {

    const key = relDir ?? "";

    const entries = await workspaceListDir(relDir);

    const seen = new Set<string>();

    const deduped = entries.filter((e) => {

      const p = String((e as any)?.path || "");

      if (!p) return false;

      if (seen.has(p)) return false;

      seen.add(p);

      return true;

    });

    setExplorer((prev) => ({ ...prev, [key]: deduped }));

  }, []);



  useEffect(() => {

    refreshDirRef.current = refreshDir;

  }, [refreshDir]);



  const getEntry = useCallback(

    (path: string): DirEntryInfo | null => {

      const parent = path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";

      const list = explorer[parent];

      if (!list) return null;

      return list.find((e) => e.path === path) ?? null;

    },

    [explorer]

  );



  const baseDirForCreate = useCallback(

    (selected: string | null): string => {

      if (!selected) return "";

      const info = getEntry(selected);

      if (info?.is_dir) return selected;

      return selected.includes("/") ? selected.split("/").slice(0, -1).join("/") : "";

    },

    [getEntry]

  );



  const refreshRoot = useCallback(async () => {

    setExplorer({});

    setExpandedDirs(new Set([""]));

    setSelectedPath(null);

    if (!workspace.root) return;

    await refreshDir(undefined);

  }, [refreshDir, workspace.root]);



  const getSavedWorkspaces = useCallback((): SavedWorkspace[] => {

    const items = (settings.saved_workspaces ?? []).filter((w) => !!String(w?.name ?? "").trim());

    const deduped: SavedWorkspace[] = [];

    const seen = new Set<string>();

    for (const w of items) {

      const key = String(w.name ?? "").trim().toLowerCase();

      if (!key || seen.has(key)) continue;

      seen.add(key);

      deduped.push({ name: String(w.name ?? "").trim(), roots: Array.isArray(w.roots) ? w.roots : [], updated_at: w.updated_at });

    }

    return deduped;

  }, [settings.saved_workspaces]);



  const persistSavedWorkspaces = useCallback(

    async (items: SavedWorkspace[]) => {

      const next: AppSettings = { ...settings, saved_workspaces: items };

      setSettingsState(next);

      try {

        await settingsSet(next);

      } catch (e) {

        devConsoleError("Failed to save saved workspaces", e);

        notify({ kind: "error", title: "Workspace", message: "Failed to save workspaces" });

        setSettingsState(settings);

      }

    },

    [devConsoleError, notify, settings]

  );



  const openSavedWorkspaceByRoots = useCallback(

    async (rootsRaw: string[]) => {

      const roots = (Array.isArray(rootsRaw) ? rootsRaw : [])

        .map((x) => String(x || "").trim())

        .filter(Boolean)

        .map((x) => x.replace(/\\/g, "/"));

      if (!roots.length) {

        notify({ kind: "error", title: "Workspace", message: "Saved workspace contains no folders." });

        return;

      }

      const w0 = await workspaceSet(roots[0]);

      let w = w0;

      for (const r of roots.slice(1)) {

        w = await workspaceAddRoot(r);

      }

      setWorkspaceState(w);

      setSettingsState((s) => ({

        ...s,

        workspace_root: w.root,

        workspace_roots: w.roots,

        recent_workspaces: w.recent,

      }));

      setTabs((prev) => {

        prev.forEach(revokeTabObjectUrl);

        return [];

      });

      setActiveTabPath(null);

      await refreshRoot();

      notify({ kind: "info", title: "Workspace", message: `Opened workspace (${roots.length} folder${roots.length === 1 ? "" : "s"}).` });

    },

    [notify, refreshRoot, workspaceAddRoot, workspaceSet]

  );



  const openSavedWorkspaceByName = useCallback(

    async (name: string) => {

      const picked = getSavedWorkspaces().find((x) => x.name.trim().toLowerCase() === String(name || "").trim().toLowerCase());

      if (!picked) {

        notify({ kind: "error", title: "Workspace", message: "Workspace not found." });

        return;

      }

      try {

        await openSavedWorkspaceByRoots(picked.roots ?? []);

        setIsSavedWorkspacesOpen(false);

      } catch (e) {

        devConsoleError("Open saved workspace failed", e);

        notify({ kind: "error", title: "Workspace", message: `Failed to open workspace: ${String(e)}` });

      }

    },

    [devConsoleError, getSavedWorkspaces, notify, openSavedWorkspaceByRoots]

  );



  const addFolderToWorkspace = useCallback(async () => {

    if (!workspace.root) {

      await openFolder();

      return;

    }

    const folder = await workspacePickFolder();

    if (!folder) return;

    let w: WorkspaceInfo;

    try {

      w = await workspaceAddRoot(folder);

    } catch (e) {

      devConsoleError("Add folder to workspace failed", e);

      notify({ kind: "error", title: "Workspace", message: `Failed to add folder: ${String(e)}` });

      return;

    }

    setWorkspaceState(w);

    setSettingsState((s) => ({

      ...s,

      workspace_root: w.root,

      workspace_roots: w.roots,

      recent_workspaces: w.recent,

    }));

    await refreshRoot();

  }, [refreshRoot, workspaceAddRoot]);



  const openAbsFileInEditor = useCallback(

    async (absPath: string) => {

      const file = String(absPath || "").replace(/\\/g, "/");

      if (!file) return;

      if (isImagePath(file)) {

        const fb = await fsReadFileAbsBase64(file);

        const url = base64ToObjectUrl(fb.mime, fb.base64);

        const tab: EditorTab = {

          path: file,

          name: basename(file),

          language: detectLanguage(file),

          content: "",

          isDirty: false,

          kind: "image",

          image: { mime: fb.mime, url },

        };

        setTabs((prev) => {

          const key = file.toLowerCase();

          const existing = prev.find((t) => String(t.path || "").replace(/\\/g, "/").toLowerCase() === key);

          if (existing) {

            if (existing.kind === "image") {

              try {

                URL.revokeObjectURL(url);

              } catch {

              }

              setActiveTabPath(existing.path);

              return prev;

            }

            setActiveTabPath(file);

            return prev.map((t) => (t.path === existing.path ? tab : t));

          }

          setActiveTabPath(file);

          return [...prev, tab];

        });

        rememberRecentFile(file);

        return;

      }

      const content = await fsReadFileAbs(file);

      const tab: EditorTab = {

        path: file,

        name: basename(file),

        language: detectLanguage(file),

        content,

        isDirty: false,

        kind: "text",

      };

      setTabs((prev) => {

        const key = file.toLowerCase();

        const existing = prev.find((t) => String(t.path || "").replace(/\\/g, "/").toLowerCase() === key);

        if (existing) {

          setActiveTabPath(existing.path);

          return prev;

        }

        setActiveTabPath(file);

        return [...prev, tab];

      });

      rememberRecentFile(file);

    },

    [rememberRecentFile]

  );



  const parseVirtualRootPath = useCallback((p: string) => {

    const norm = String(p || "").replace(/\\/g, "/");

    if (!norm.startsWith("__wsroot__/")) return null;

    const rest = norm.slice("__wsroot__/".length);

    const [idxRaw, ...tailParts] = rest.split("/");

    const idx = Number(idxRaw);

    if (!Number.isFinite(idx) || idx < 0) return null;

    return { idx, tail: tailParts.join("/") };

  }, []);

  const resolveAbsPathFromExplorerPath = useCallback(

    (p: string): string | null => {

      const norm = String(p || "").replace(/\\/g, "/");

      if (!norm) return null;

      const v = parseVirtualRootPath(norm);

      if (v) {

        const roots = workspace.roots?.length ? workspace.roots : settings.workspace_roots;

        const base = String(roots?.[v.idx] || "").replace(/\\/g, "/").replace(/\/$/, "");

        if (!base) return null;

        if (!v.tail) return base;

        const rel = v.tail.replace(/^\//, "");

        return `${base}/${rel}`;

      }

      const base = String(workspace.root || "").replace(/\\/g, "/").replace(/\/$/, "");

      if (!base) return null;

      if (norm === "") return base;

      const rel = norm.replace(/^\//, "");

      return base && rel ? `${base}/${rel}` : norm;

    },

    [parseVirtualRootPath, settings.workspace_roots, workspace.root, workspace.roots]

  );



  const removeFolderFromWorkspace = useCallback(

    async (absFolder: string) => {

      const w = await workspaceRemoveRoot(absFolder);

      setWorkspaceState(w);

      setSettingsState((s) => ({

        ...s,

        workspace_root: w.root,

        workspace_roots: w.roots,

        recent_workspaces: w.recent,

      }));

      await refreshRoot();

    },

    [refreshRoot, workspaceRemoveRoot]

  );



  useEffect(() => {

    void refreshRoot();

  }, [refreshRoot]);



  useEffect(() => {

    // Clear cached file index when workspace root changes.

    setFileIndexRoot(null);

    setFileIndex([]);

  }, [workspace.root]);



  useEffect(() => {

    chatMessagesRef.current = activeChat.messages;

  }, [activeChat.messages]);



  const chatScrollKey = useMemo(() => {

    const msgs = (activeChat.messages ?? []).filter((m) => m.role !== "meta");

    const last = msgs[msgs.length - 1];

    if (!last) return "";

    if (last.kind === "event_stream" && last.eventStream) {

      const lastEv = last.eventStream.events?.[last.eventStream.events.length - 1];

      return `${last.id ?? ""}:${last.eventStream.status}:${last.eventStream.events?.length ?? 0}:${lastEv?.id ?? ""}`;

    }

    return `${last.id ?? ""}:${(last.content ?? "").length}`;

  }, [activeChat.messages]);



  const chatStickToBottomRef = useRef(true);

  const syncChatStickinessFromEl = useCallback((el: HTMLDivElement) => {

    const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);

    chatStickToBottomRef.current = dist < 48;

  }, []);



  useEffect(() => {

    const el = chatScrollRef.current;

    if (!el) return;

    if (!chatStickToBottomRef.current) return;

    window.requestAnimationFrame(() => {

      const el2 = chatScrollRef.current;

      if (!el2) return;

      el2.scrollTop = el2.scrollHeight;

    });

  }, [chatScrollKey, chatBusy]);



  useEffect(() => {

    return () => {

      if (chatStreamTimerRef.current) window.clearInterval(chatStreamTimerRef.current);

    };

  }, []);



  const setMessageRating = useCallback(

    (index: number, rating: "up" | "down") => {

      setActiveChatMessages((prev) => {

        const next = prev.slice();

        const m = next[index];

        if (!m || m.role !== "assistant") return prev;

        const nextRating = m.rating === rating ? null : rating;

        next[index] = { ...m, rating: nextRating };

        return next;

      });

    },

    [setActiveChatMessages]

  );



  useEffect(() => {

    if (!isChatDockOpen) return;

    const t = window.setTimeout(() => chatComposerRef.current?.focus(), 0);

    return () => window.clearTimeout(t);

  }, [activeChatId, isChatDockOpen]);



  const openFolder = useCallback(async () => {

    try {

      const folder = await workspacePickFolder();

      if (!folder) {

        notify({ kind: "info", title: "Open folder", message: "No folder was selected." });

        return;

      }



      const w = await workspaceSet(folder);

      setWorkspaceState(w);

      setSettingsState((s) => ({

        ...s,

        workspace_root: w.root,

        recent_workspaces: w.recent,

      }));

      setTabs((prev) => {

        prev.forEach(revokeTabObjectUrl);

        return [];

      });

      setActiveTabPath(null);

      await refreshRoot();

    } catch (e) {

      devConsoleError("Open folder failed", e);

      notify({ kind: "error", title: "Open folder", message: `Failed to open folder: ${String(e)}` });

    }

  }, [devConsoleError, notify, refreshRoot]);



  const openRecent = useCallback(

    async (root: string) => {

      const w = await workspaceSet(root);

      setWorkspaceState(w);

      setSettingsState((s) => ({

        ...s,

        workspace_root: w.root,

        recent_workspaces: w.recent,

      }));

      setTabs((prev) => {

        prev.forEach(revokeTabObjectUrl);

        return [];

      });

      setActiveTabPath(null);

      await refreshRoot();

    },

    [refreshRoot]

  );



  const openFile = useCallback(

    async (relPath: string) => {

      const norm = normalizeRelPath(relPath);

      if (!norm) return;



      if (isImagePath(norm)) {

        try {

          const fb = await workspaceReadFileBase64(norm);

          const url = base64ToObjectUrl(fb.mime, fb.base64);

          const tab: EditorTab = {

            path: norm,

            name: basename(norm),

            language: detectLanguage(norm),

            content: "",

            isDirty: false,

            kind: "image",

            image: { mime: fb.mime, url },

          };



          setTabs((prev) => {

            const key = norm.toLowerCase();

            const existing = prev.find((t) => String(t.path || "").replace(/\\/g, "/").toLowerCase() === key);

            if (existing) {

              if (existing.kind === "image") {

                // We already have an image tab open; avoid leaking the newly created blob URL.

                try {

                  URL.revokeObjectURL(url);

                } catch {

                }

                setActiveTabPath(existing.path);

                return prev;

              }



              // If the file was previously opened as text, replace it with the image tab.

              setActiveTabPath(norm);

              return prev.map((t) => (t.path === existing.path ? tab : t));

            }

            setActiveTabPath(norm);

            return [...prev, tab];

          });



          if (workspace.root) {

            const abs = `${workspace.root.replace(/\\/g, "/").replace(/\/$/, "")}/${norm}`;

            rememberRecentFile(abs);

          }

        } catch (e) {

          notifyRef.current?.({ kind: "error", title: "Open image failed", message: String(e) });

        }

        return;

      }



      let content = "";

      try {

        content = await workspaceReadFile(norm);

      } catch {

        content = "";

      }

      const tab: EditorTab = {

        path: norm,

        name: basename(norm),

        language: detectLanguage(norm),

        content,

        isDirty: false,

        kind: "text",

      };



      setTabs((prev) => {

        const key = norm.toLowerCase();

        const existing = prev.find((t) => String(t.path || "").replace(/\\/g, "/").toLowerCase() === key);

        if (existing) {

          setActiveTabPath(existing.path);

          return prev;

        }

        setActiveTabPath(norm);

        return [...prev, tab];

      });



      if (workspace.root) {

        const abs = `${workspace.root.replace(/\\/g, "/").replace(/\/$/, "")}/${norm}`;

        rememberRecentFile(abs);

      }

    },

    [rememberRecentFile, workspace.root]

  );



  const openFileText = useCallback(

    async (relPath: string) => {

      const norm = normalizeRelPath(relPath);

      if (!norm) return;



      let content = "";

      try {

        content = await workspaceReadFile(norm);

      } catch {

        content = "";

      }



      setTabs((prev) => {

        const existing = prev.find((t) => t.path === norm);

        if (existing?.kind === "image" && existing.image?.url?.startsWith("blob:")) {

          try {

            URL.revokeObjectURL(existing.image.url);

          } catch {

          }

        }

        const without = prev.filter((t) => t.path !== norm);

        const tab: EditorTab = {

          path: norm,

          name: basename(norm),

          language: detectLanguage(norm),

          content,

          isDirty: false,

          kind: "text",

        };

        return [...without, tab];

      });

      setActiveTabPath(norm);

    },

    []

  );



  const refreshImageTab = useCallback(async (relPath: string) => {

    const norm = normalizeRelPath(relPath);

    if (!norm) return;

    try {

      const fb = await workspaceReadFileBase64(norm);

      const url = base64ToObjectUrl(fb.mime, fb.base64);

      setTabs((prev) =>

        prev.map((t) => {

          if (t.path !== norm) return t;

          if (t.kind === "image" && t.image?.url?.startsWith("blob:")) {

            try {

              URL.revokeObjectURL(t.image.url);

            } catch {

            }

          }

          return { ...t, kind: "image", image: { mime: fb.mime, url }, content: "", isDirty: false };

        })

      );

    } catch (e) {

      notifyRef.current?.({ kind: "error", title: "Reload image failed", message: String(e) });

    }

  }, []);



  const changeWriteFiles = useMemo(() => {

    const cs = activeChat.changeSet;

    if (!cs) return [] as ChangeFile[];

    return cs.files.filter((f) => f.kind === "write" && typeof f.path === "string");

  }, [activeChat.changeSet]);



  const [selectedChangePath, setSelectedChangePath] = useState<string | null>(null);



  const updateEventStream = useCallback(

    (

      id: string,

      up: (prev: NonNullable<ChatUiMessage["eventStream"]>) => NonNullable<ChatUiMessage["eventStream"]>

    ) => {

      setActiveChatMessages((prev) =>

        prev.map((m) => {

          if (m.id !== id || m.kind !== "event_stream" || !m.eventStream) return m;

          return { ...m, eventStream: up(m.eventStream) };

        })

      );

    },

    [setActiveChatMessages]

  );



  const appendEventStream = useCallback(

    (id: string, inputs: AiEventInput[]) => {

      const now = Date.now();

      const next = toChatEvents(inputs, now);

      const ttlTargets = next.filter((e) => e.type === "state" && typeof e.ttlMs === "number" && !e.hidden) as Array<

        ChatEventBase & { type: "state"; content: string; hidden?: boolean; ttlMs?: number }

      >;



      updateEventStream(id, (es) => ({ ...es, events: ([...(es.events ?? []), ...next] as ChatEvent[]).slice(-240) }));



      for (const e of ttlTargets) {

        const ttl = Math.max(150, Math.min(60000, Math.floor(e.ttlMs ?? 0)));

        window.setTimeout(() => {

          updateEventStream(id, (es) => ({

            ...es,

            events: (es.events ?? []).map((x) => (x.id === e.id && x.type === "state" ? { ...x, hidden: true } : x)),

          }));

        }, ttl);

      }

    },

    [updateEventStream]

  );



  const [isChangeSummaryOpen, setIsChangeSummaryOpen] = useState(false);

  const lastChangeSetIdRef = useRef<string | null>(null);



  useEffect(() => {

    const id = activeChat.changeSet?.id ?? null;

    if (id !== lastChangeSetIdRef.current) {

      lastChangeSetIdRef.current = id;

      setIsChangeSummaryOpen(false);

    }

  }, [activeChat.changeSet?.id]);



  useEffect(() => {

    if (!activeChat.changeSet) {

      setSelectedChangePath(null);

      return;

    }

    if (!changeWriteFiles.length) return;

    const exists = selectedChangePath && changeWriteFiles.some((f) => f.path === selectedChangePath);

    if (exists) return;

    const first = changeWriteFiles[0]!.path;

    setSelectedChangePath(first);

    void openFile(first);

  }, [activeChat.changeSet, changeWriteFiles, openFile, selectedChangePath]);



  const acceptAllChanges = useCallback(() => {

    const cs = activeChat.changeSet;

    if (!cs) return;

    if (cs.applied) {

      setActiveChatChangeSet(null);

      setSelectedChangePath(null);

      addLog({ kind: "action", title: "Accepted all changes", status: "done" });

      return;

    }



    void (async () => {

      if (!workspace.root) {

        notifyRef.current?.({ kind: "error", title: "No workspace", message: "Open a folder first." });

        return;

      }

      const ok = await confirmApplyChangeSet(cs);

      if (!ok) return;



      const runCmds = new Set<string>();

      for (const e of cs.edits) {

        const op = String(e.op || "").toLowerCase();

        if (op !== "run") continue;

        const cmd = String(e.content ?? "").trim();

        if (cmd) runCmds.add(cmd);

      }

      const nonRun = cs.edits.filter((e) => String(e.op || "").toLowerCase() !== "run").length;

      const total = Math.max(1, nonRun + runCmds.size);



      const activityId = `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setActiveChatMessages((prev) => [

        ...prev,

        {

          id: activityId,

          role: "assistant",

          content: "",

          kind: "activity",

          activity: { title: "Applying changes", status: "running", steps: [], progress: { done: 0, total, current: "Starting…" } },

        },

      ]);



      setChatApplying(true);

      let done = 0;

      try {

        const onStep = (msg: string) => {

          appendActivityStep(activityId, msg);

          const t = String(msg || "").trim();

          if (!t) return;

          if (/^(write|patch|delete|rename|run)\b/i.test(t)) {

            done = Math.min(total, done + 1);

            setActivityProgress(activityId, { done, total, current: t });

          }

        };



        await applyAiEditsNow(cs.edits, onStep, {

          pace: true,

          previewFile: async (p) => {

            setSelectedChangePath(p);

            await openFile(p);

          },

        });

        done = total;

        setActivityProgress(activityId, { done, total, current: "Done" });

        setActivityStatus(activityId, "done");

        setActiveChatChangeSet({ ...cs, applied: true });

      } catch (e) {

        appendActivityStep(activityId, `Failed: ${String(e)}`);

        setActivityProgress(activityId, { done: Math.min(done, total), total, current: "Failed" });

        setActivityStatus(activityId, "error");

      } finally {

        setChatApplying(false);

      }

    })();

  }, [activeChat.changeSet, appendActivityStep, applyAiEditsNow, confirmApplyChangeSet, openFile, setActiveChatChangeSet, setActivityProgress, setActivityStatus, setSelectedChangePath, workspace.root]);



  const rejectAllChanges = useCallback(async () => {

    const chatChangeSet = activeChat.changeSet;

    if (!chatChangeSet) return;

    if (!chatChangeSet.applied) {

      setActiveChatChangeSet(null);

      setSelectedChangePath(null);

      addLog({ kind: "action", title: "Discarded proposed changes", status: "done" });

      return;

    }



    if (!workspace.root) {

      notifyRef.current?.({ kind: "error", title: "No workspace", message: "Open a folder first." });

      return;

    }



    setChatApplying(true);

    try {

      // Revert in reverse order to minimize conflicts.

      const reverse: AiEditOp[] = [];

      for (let i = chatChangeSet.files.length - 1; i >= 0; i--) {

        const f = chatChangeSet.files[i]!;

        if (f.kind === "write") {

          if (f.before === null) {

            reverse.push({ op: "delete", path: f.path });

          } else {

            reverse.push({ op: "write", path: f.path, content: f.before });

          }

        } else if (f.kind === "delete") {

          if (f.before !== null) reverse.push({ op: "write", path: f.path, content: f.before });

        } else if (f.kind === "rename") {

          const parts = f.path.split(" → ");

          if (parts.length === 2) {

            reverse.push({ op: "rename", from: parts[1]!, to: parts[0]! });

          }

        }

      }



      await applyAiEditsNow(reverse);

      setActiveChatChangeSet(null);

      setSelectedChangePath(null);

      addLog({ kind: "action", title: "Reverted all changes", status: "done" });

    } catch (e) {

      notifyRef.current?.({ kind: "error", title: "Revert failed", message: String(e) });

    } finally {

      setChatApplying(false);

    }

  }, [activeChat.changeSet, applyAiEditsNow, setActiveChatChangeSet, setActiveChatMessages, workspace.root]);



  const acceptFileChange = useCallback(

    (path: string) => {

      const cs = activeChat.changeSet;

      if (!cs) return;

      if (!cs.applied) {

        void (async () => {

          if (!workspace.root) {

            notifyRef.current?.({ kind: "error", title: "No workspace", message: "Open a folder first." });

            return;

          }

          const fileEdits = cs.edits.filter((e) => {

            const op = String(e.op || "").toLowerCase();

            if (op === "write" || op === "patch" || op === "delete") return String(e.path || "").trim() === path;

            return false;

          });



          if (!fileEdits.length) {

            const nextFiles = cs.files.filter((f) => !(f.kind === "write" && f.path === path));

            const next = { ...cs, files: nextFiles, stats: computeStats(nextFiles) };

            setActiveChatChangeSet(nextFiles.length ? next : null);

            return;

          }



          setChatApplying(true);

          try {

            await applyAiEditsNow(fileEdits, undefined, { pace: true, previewFile: async (p) => void openFile(p) });

          } finally {

            setChatApplying(false);

          }



          setActiveChatChangeSet({ ...cs, applied: true });

          addLog({ kind: "action", title: `Applied ${path}`, status: "done" });

        })();

        return;

      }

      const nextFiles = cs.files.filter((f) => !(f.kind === "write" && f.path === path));

      if (!nextFiles.length) {

        setActiveChatChangeSet(null);

        setSelectedChangePath(null);

        return;

      }

      const next = { ...cs, files: nextFiles, stats: computeStats(nextFiles) };

      setActiveChatChangeSet(next);

      if (!nextFiles.some((f) => f.kind === "write" && f.path === selectedChangePath)) {

        const first = nextFiles.find((f) => f.kind === "write") as ChangeFile | undefined;

        if (first?.kind === "write") {

          setSelectedChangePath(first.path);

          void openFile(first.path);

        }

      }

    },

    [activeChat.changeSet, openFile, selectedChangePath, setActiveChatChangeSet]

  );



  const rejectFileChange = useCallback(

    async (path: string) => {

      const cs = activeChat.changeSet;

      if (!cs) return;

      const f = cs.files.find((x) => x.kind === "write" && x.path === path);

      if (!f || f.kind !== "write") return;

      if (!cs.applied) {

        const nextFiles = cs.files.filter((x) => !(x.kind === "write" && x.path === path));

        if (!nextFiles.length) {

          setActiveChatChangeSet(null);

          setSelectedChangePath(null);

          return;

        }

        const next = { ...cs, files: nextFiles, stats: computeStats(nextFiles) };

        setActiveChatChangeSet(next);

        if (!nextFiles.some((x) => x.kind === "write" && x.path === selectedChangePath)) {

          const first = nextFiles.find((x) => x.kind === "write") as ChangeFile | undefined;

          if (first?.kind === "write") {

            setSelectedChangePath(first.path);

            void openFile(first.path);

          }

        }

        return;

      }

      if (!workspace.root) {

        notifyRef.current?.({ kind: "error", title: "No workspace", message: "Open a folder first." });

        return;

      }



      setChatApplying(true);

      try {

        if (f.before === null) {

          await workspaceDelete(path);

          setTabs((prev) => prev.filter((t) => t.path !== path));

          if (activeTabPath === path) setActiveTabPath(null);

        } else {

          await workspaceWriteFile(path, f.before);

          setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content: f.before ?? "", isDirty: false } : t)));

        }



        const nextFiles = cs.files.filter((x) => !(x.kind === "write" && x.path === path));

        if (!nextFiles.length) {

          setActiveChatChangeSet(null);

          setSelectedChangePath(null);

          return;

        }

        const next = { ...cs, files: nextFiles, stats: computeStats(nextFiles) };

        setActiveChatChangeSet(next);

        if (!nextFiles.some((x) => x.kind === "write" && x.path === selectedChangePath)) {

          const first = nextFiles.find((x) => x.kind === "write") as ChangeFile | undefined;

          if (first?.kind === "write") {

            setSelectedChangePath(first.path);

            void openFile(first.path);

          }

        }

      } catch (e) {

        notifyRef.current?.({ kind: "error", title: "Reject failed", message: String(e) });

      } finally {

        setChatApplying(false);

      }

    },

    [activeChat.changeSet, activeTabPath, openFile, selectedChangePath, setActiveChatChangeSet, workspace.root]

  );



  const ensureFileIndex = useCallback(async () => {

    if (!workspace.root) return;

    if (isFileIndexLoading) return;

    if (fileIndexRoot === workspace.root && fileIndex.length) return;



    setIsFileIndexLoading(true);

    try {

      const files = await workspaceListFiles(20000);

      const seen = new Set<string>();

      const deduped = files

        .map((p) => normalizeRelPath(p))

        .filter((p) => {

          const k = String(p || "");

          if (!k) return false;

          if (seen.has(k)) return false;

          seen.add(k);

          return true;

        });

      setFileIndex(deduped);

      setFileIndexRoot(workspace.root);

    } finally {

      setIsFileIndexLoading(false);

    }

  }, [fileIndex.length, fileIndexRoot, isFileIndexLoading, workspace.root]);



  const openQuickOpen = useCallback(async () => {

    if (!workspace.root) {

      await openFolder();

      return;

    }

    setIsQuickOpenOpen(true);

    setQuickOpenQuery("");

    setQuickOpenIndex(0);

    void ensureFileIndex();

  }, [ensureFileIndex, openFolder, workspace.root]);



  const openStandaloneFile = useCallback(async () => {

    try {

      const file = await workspacePickFile();

      if (!file) {

        notify({ kind: "info", title: "Open file", message: "No file was selected." });

        return;

      }



      await openAbsFileInEditor(file);

    } catch (e) {

      devConsoleError("Open file failed", e);

      notify({ kind: "error", title: "Open file", message: `Failed to open file: ${String(e)}` });

    }

  }, [devConsoleError, notify, openAbsFileInEditor, workspacePickFile]);



  const openSavedWorkspace = useCallback(async () => {

    setIsSavedWorkspacesOpen(true);

  }, []);



  const runEditCommand = useCallback(

    (kind: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll") => {

      const ed = editorRef.current;

      // Prefer our custom clipboard implementation when Monaco is present.
      // (Monaco's built-in clipboard actions can be broken in some Tauri environments.)
      if (ed) {

        try {

          if (kind === "selectAll") {

            try {

              const act = ed.getAction?.("editor.action.selectAll");

              if (act) {

                void act.run();

                return;

              }

            } catch {

            }

            try {

              document.execCommand("selectAll");

            } catch {

            }

            return;

          }

          if (kind === "copy" || kind === "cut") {

            const model = ed.getModel?.();

            const selections = (ed.getSelections?.() as any[] | null | undefined) ?? [];

            if (!model || selections.length === 0) return;

            const nonEmpty = selections.filter((s) => !s?.isEmpty?.());

            if (nonEmpty.length === 0) return;

            const eol = typeof model?.getEOL === "function" ? (model.getEOL() as string) : "\n";

            const parts = nonEmpty.map((sel) => model.getValueInRange(sel) as string);

            const text = parts.join(eol);

            void (async () => {

              try {

                await clipboardWriteText(text);

                return;

              } catch {

              }

              try {

                await wslClipboardWriteText(text);

                return;

              } catch {

              }

              try {

                if (navigator.clipboard?.writeText) {

                  await navigator.clipboard.writeText(text);

                  return;

                }

              } catch {

              }

              try {

                const textarea = document.createElement("textarea");

                textarea.value = text;

                textarea.style.position = "fixed";

                textarea.style.left = "-9999px";

                document.body.appendChild(textarea);

                textarea.select();

                document.execCommand("copy");

                document.body.removeChild(textarea);

              } catch {

              }

            })();

            if (kind === "cut") {

              try {

                ed.pushUndoStop?.();

                ed.executeEdits?.(

                  "clipboard",

                  nonEmpty.map((sel) => ({ range: sel, text: "" }))

                );

                ed.pushUndoStop?.();

              } catch {

              }

            }

            return;

          }

          if (kind === "paste") {

            void (async () => {

              let text: string | null = null;

              try {

                text = await clipboardReadText();

              } catch {

              }

              if (typeof text !== "string") {

                try {

                  text = await wslClipboardReadText();

                } catch {

                }

              }

              if (typeof text !== "string") {

                try {

                  if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();

                } catch {

                }

              }

              if (typeof text !== "string") return;

              const sels = (ed.getSelections?.() as any[] | null | undefined) ?? [];

              if (sels.length === 0) return;

              try {

                ed.pushUndoStop?.();

                ed.executeEdits?.(

                  "clipboard",

                  sels.map((sel) => ({ range: sel, text }))

                );

                ed.pushUndoStop?.();

              } catch {

              }

            })();

            return;

          }

        } catch {

        }

      }

      if (ed) {

        const actionMap: Record<typeof kind, string[]> = {

          undo: ["undo", "editor.action.undo"],

          redo: ["redo", "editor.action.redo"],

          cut: ["editor.action.clipboardCutAction"],

          copy: ["editor.action.clipboardCopyAction"],

          paste: ["editor.action.clipboardPasteAction"],

          selectAll: ["editor.action.selectAll"],

        };

        for (const id of actionMap[kind]) {

          try {

            const act = ed.getAction(id);

            if (act) {

              void act.run();

              return;

            }

          } catch {

          }

        }

      }

      const cmdMap: Record<typeof kind, string> = {

        undo: "undo",

        redo: "redo",

        cut: "cut",

        copy: "copy",

        paste: "paste",

        selectAll: "selectAll",

      };

      try {

        document.execCommand(cmdMap[kind]);

      } catch {

      }

    },

    []

  );



  const replaceInFiles = useCallback(async () => {

    if (!workspace.root) {

      notify({ kind: "info", title: "Replace in Files", message: "Open a folder first." });

      return;

    }

    setActivity("search");

    const find = window.prompt("Replace in Files: Find");

    if (!find) return;

    const repl = window.prompt("Replace in Files: Replace with", "");

    if (repl === null) return;

    const ok = await requestConfirm("Replace in Files", `Replace all occurrences of '${find}' across workspace files?`, {

      confirmLabel: "Replace",

      danger: true,

    });

    if (!ok) return;

    let changedFiles = 0;

    let changedOccurrences = 0;

    const files = await workspaceListFiles(20000);

    for (const p of files) {

      try {

        const content = await workspaceReadFile(p);

        if (!content.includes(find)) continue;

        const next = content.split(find).join(repl);

        if (next === content) continue;

        const count = content.split(find).length - 1;

        await workspaceWriteFile(p, next);

        changedFiles += 1;

        changedOccurrences += count;

      } catch {

        // ignore non-text/binary files

      }

    }

    notify({ kind: "info", title: "Replace in Files", message: `Replaced ${changedOccurrences} occurrence${changedOccurrences === 1 ? "" : "s"} in ${changedFiles} file${changedFiles === 1 ? "" : "s"}.` });

    await refreshRoot();

  }, [notify, refreshRoot, requestConfirm, setActivity, workspace.root, workspaceListFiles, workspaceReadFile, workspaceWriteFile]);



  useEffect(() => {

    if (!autoSaveEnabled) return;

    if (!activeTab) return;

    if (!activeTab.isDirty) return;

    if (activeTab.path.startsWith("untitled:")) return;



    const t = window.setTimeout(() => {

      void (async () => {

        try {

          await workspaceWriteFile(activeTab.path, activeTab.content);

          setTabs((prev) => prev.map((x) => (x.path === activeTab.path ? { ...x, isDirty: false } : x)));

        } catch (e) {

          devConsoleError("Auto save failed", e);

        }

      })();

    }, 600);



    return () => window.clearTimeout(t);

  }, [activeTab, autoSaveEnabled]);



  const goToLine = useCallback(

    (lineNumber: number) => {

      if (!activeTab) return;

      const ed = editorRef.current;

      if (ed) {

        const model = ed.getModel();

        const line = model ? Math.max(1, Math.min(lineNumber, model.getLineCount())) : Math.max(1, lineNumber);

        ed.revealLineInCenter(line);

        ed.setPosition({ lineNumber: line, column: 1 });

        ed.focus();

        return;

      }

      setPendingReveal({ path: activeTab.path, line: Math.max(1, lineNumber), text: "" });

    },

    [activeTab]

  );



  const openGoToLine = useCallback(() => {

    if (!activeTab) return;

    setIsGoToLineOpen(true);

    setGoToLineValue("");

  }, [activeTab]);



  useEffect(() => {

    if (!pendingReveal) return;

    if (!activeTab) return;

    if (activeTab.path !== pendingReveal.path) return;

    const ed = editorRef.current;

    if (!ed) return;



    const model = ed.getModel();

    if (!model) return;

    const line = Math.max(1, Math.min(pendingReveal.line, model.getLineCount()));

    ed.revealLineInCenter(line);

    ed.setPosition({ lineNumber: line, column: 1 });

    ed.focus();

    setPendingReveal(null);

  }, [activeTab, pendingReveal]);



  const commitInlineRename = useCallback(

    async (opts?: { openAfter?: boolean }) => {

      const fromRel = inlineRenamePath;

      if (!fromRel) return;



      const raw = inlineRenameValue.trim();

      if (!raw) {

        setInlineRenamePath(null);

        setInlineRenameValue("");

        return;

      }



      const nextName = raw.includes(".") ? raw : `${raw}.txt`;

      const parent = fromRel.includes("/") ? fromRel.split("/").slice(0, -1).join("/") : "";

      const toRel = parent ? `${parent}/${nextName}` : nextName;



      setInlineRenamePath(null);

      setInlineRenameValue("");



      if (toRel === fromRel) {

        if (opts?.openAfter) await openFile(toRel);

        return;

      }



      await workspaceRename(fromRel, toRel);



      setTabs((prev) =>

        prev.map((t) => {

          if (t.path === fromRel) {

            return { ...t, path: toRel, name: basename(toRel) };

          }

          const prefix = fromRel.endsWith("/") ? fromRel : `${fromRel}/`;

          if (t.path.startsWith(prefix)) {

            const rest = t.path.slice(prefix.length);

            const nextPath = `${toRel}/${rest}`;

            return { ...t, path: nextPath, name: basename(nextPath) };

          }

          return t;

        })

      );



      setActiveTabPath((prev) => {

        if (!prev) return prev;

        if (prev === fromRel) return toRel;

        const prefix = fromRel.endsWith("/") ? fromRel : `${fromRel}/`;

        if (prev.startsWith(prefix)) {

          const rest = prev.slice(prefix.length);

          return `${toRel}/${rest}`;

        }

        return prev;

      });



      setSelectedPath(toRel);

      await refreshRoot();

      if (opts?.openAfter) await openFile(toRel);

    },

    [inlineRenamePath, inlineRenameValue, openFile, refreshRoot]

  );



  const cancelInlineRename = useCallback(async () => {

    const fromRel = inlineRenamePath;

    if (!fromRel) return;



    setInlineRenamePath(null);

    setInlineRenameValue("");



    try {

      await workspaceDelete(fromRel);

    } catch {

    }

    setSelectedPath(null);

    await refreshRoot();

  }, [inlineRenamePath, refreshRoot]);



  const createNewFolder = useCallback(async () => {

    if (!workspace.root) {

      await openFolder();

      return;

    }

    const base = baseDirForCreate(selectedPath);

    const name = await requestTextPrompt("New Folder", "", {

      subtitle: base ? `Create in: ${base}` : undefined,

      placeholder: "Folder name",

    });

    if (!name) return;

    const relName = normalizeRelPath(name);

    if (!relName) return;

    const rel = base ? `${base}/${relName}` : relName;

    await workspaceCreateDir(rel);

    await refreshDir(base || undefined);

    setSelectedPath(rel);

  }, [baseDirForCreate, openFolder, refreshDir, requestTextPrompt, selectedPath, workspace.root]);



  const renameSelected = useCallback(async () => {

    if (!selectedPath) return;

    const currentName = basename(selectedPath);

    const nextNameRaw = await requestTextPrompt("Rename to", currentName, { placeholder: currentName });

    const nextName = String(nextNameRaw ?? "").trim();

    if (!nextName || nextName === currentName) return;

    const parent = selectedPath.includes("/") ? selectedPath.split("/").slice(0, -1).join("/") : "";

    const toRel = parent ? `${parent}/${nextName}` : nextName;

    const fromRel = selectedPath;



    await workspaceRename(fromRel, toRel);



    setTabs((prev) =>

      prev.map((t) => {

        if (t.path === fromRel) {

          return { ...t, path: toRel, name: basename(toRel) };

        }

        const prefix = fromRel.endsWith("/") ? fromRel : `${fromRel}/`;

        if (t.path.startsWith(prefix)) {

          const rest = t.path.slice(prefix.length);

          const nextPath = `${toRel}/${rest}`;

          return { ...t, path: nextPath, name: basename(nextPath) };

        }

        return t;

      })

    );



    setActiveTabPath((prev) => {

      if (!prev) return prev;

      if (prev === fromRel) return toRel;

      const prefix = fromRel.endsWith("/") ? fromRel : `${fromRel}/`;

      if (prev.startsWith(prefix)) {

        const rest = prev.slice(prefix.length);

        return `${toRel}/${rest}`;

      }

      return prev;

    });



    setSelectedPath(toRel);

    await refreshRoot();

  }, [refreshRoot, requestTextPrompt, selectedPath]);



  const closeAllTabs = useCallback(async () => {

    const dirty = tabs.filter((t) => t.isDirty);

    if (dirty.length) {

      const ok = await requestConfirm("Close all", "Close all editors without saving?", { danger: true, confirmLabel: "Close" });

      if (!ok) return;

    }

    setTabs((prev) => {

      for (const t of prev) revokeTabObjectUrl(t);

      return [];

    });

    setActiveTabPath(null);

  }, [requestConfirm, tabs]);



  const deleteSelected = useCallback(async () => {

    if (!selectedPath) return;

    const ok = await requestConfirm("Delete", `Delete '${basename(selectedPath)}'?`, { danger: true, confirmLabel: "Delete" });

    if (!ok) return;

    const target = selectedPath;

    await workspaceDelete(target);



    setTabs((prev) => {

      const prefix = target.endsWith("/") ? target : `${target}/`;

      const next = prev.filter((t) => {

        if (t.path === target) return false;

        return !t.path.startsWith(prefix);

      });

      for (const t of prev) {

        const removed = t.path === target || t.path.startsWith(prefix);

        if (removed) revokeTabObjectUrl(t);

      }

      return next;

    });

    setActiveTabPath((prev) => {

      if (!prev) return prev;

      if (prev === target) return null;

      const prefix = target.endsWith("/") ? target : `${target}/`;

      if (prev.startsWith(prefix)) return null;

      return prev;

    });



    setSelectedPath(null);

    await refreshRoot();

  }, [refreshRoot, requestConfirm, selectedPath]);



  useEffect(() => {

    let cancelled = false;

    const q = searchQuery.trim();

    if (!q) {

      setSearchResults([]);

      return;

    }

    if (!workspace.root) {

      setSearchResults([]);

      return;

    }



    setIsSearching(true);

    const t = window.setTimeout(() => {

      workspaceSearch(q, 200)

        .then((res) => {

          if (cancelled) return;

          setSearchResults(res);

        })

        .catch(() => {

          if (cancelled) return;

          setSearchResults([]);

        })

        .finally(() => {

          if (cancelled) return;

          setIsSearching(false);

        });

    }, 180);



    return () => {

      cancelled = true;

      window.clearTimeout(t);

    };

  }, [searchQuery, workspace.root]);



  const closeTab = useCallback(

    async (path: string) => {

      const tab = tabs.find((t) => t.path === path);

      if (!tab) return;

      if (tab.isDirty) {

        const ok = await requestConfirm("Close editor", `Close '${tab.name}' without saving?`, { danger: true, confirmLabel: "Close" });

        if (!ok) return;

      }



      let nextActive: string | null = activeTabPath;

      setTabs((prev) => {

        const remaining = prev.filter((t) => t.path !== path);

        const prevTab = prev.find((t) => t.path === path);

        if (prevTab?.kind === "image" && prevTab.image?.url?.startsWith("blob:")) {

          try {

            URL.revokeObjectURL(prevTab.image.url);

          } catch {

          }

        }

        if (activeTabPath === path) {

          nextActive = remaining.length ? remaining[remaining.length - 1]!.path : null;

        }

        return remaining;

      });

      setActiveTabPath(nextActive);

    },

    [activeTabPath, requestConfirm, tabs]

  );



  const saveActiveFile = useCallback(async () => {

    if (!activeTab) return;

    if (activeTab.kind === "image") {

      if (!activeTab.isDirty) return;

      const dataUrl = activeTab.image?.dataUrl;

      if (!dataUrl) {

        notifyRef.current?.({ kind: "error", title: "Save image failed", message: "No edited image data to save." });

        return;

      }

      await workspaceWriteFileBase64(activeTab.path, dataUrl);

      setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, isDirty: false } : t)));

      await refreshDir(activeTab.path.includes("/") ? activeTab.path.split("/").slice(0, -1).join("/") : undefined);

      return;

    }

    if (activeTab.path.startsWith("untitled:")) {

      if (!workspace.root) {

        await openFolder();

        if (!workspace.root) return;

      }

      const name = await requestRelativePath("Save As", activeTab.name, {

        subtitle: "Save relative to the workspace root",

        placeholder: "folder/file",

        extensions: ["txt", "md", "json", "ts", "tsx", "js", "jsx", "css", "html"],

      });

      if (!name) return;

      const rel = name.trim().replace(/\\/g, "/");

      if (!rel) return;

      await workspaceWriteFile(rel, activeTab.content);

      setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, path: rel, name: basename(rel), language: detectLanguage(rel), isDirty: false } : t)));

      setActiveTabPath(rel);

      return;

    }

    await workspaceWriteFile(activeTab.path, activeTab.content);

    setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, isDirty: false } : t)));

    await refreshDir(activeTab.path.includes("/") ? activeTab.path.split("/").slice(0, -1).join("/") : undefined);

  }, [activeTab, openFolder, refreshDir, requestRelativePath, workspace.root]);



  const saveAll = useCallback(async () => {

    const dirty = tabs.filter((t) => t.isDirty);

    for (const t of dirty) {

      if (t.kind === "image") {

        const dataUrl = t.image?.dataUrl;

        if (!dataUrl) continue;

        await workspaceWriteFileBase64(t.path, dataUrl);

        setTabs((prev) => prev.map((x) => (x.path === t.path ? { ...x, isDirty: false } : x)));

        continue;

      }

      if (t.path.startsWith("untitled:")) {

        setActiveTabPath(t.path);

        const name = await requestRelativePath("Save As", t.name, {

          subtitle: "Save relative to the workspace root",

          placeholder: "folder/file",

          extensions: ["txt", "md", "json", "ts", "tsx", "js", "jsx", "css", "html"],

        });

        if (!name) continue;

        const rel = name.trim().replace(/\\/g, "/");

        if (!rel) continue;

        await workspaceWriteFile(rel, t.content);

        setTabs((prev) =>

          prev.map((x) => (x.path === t.path ? { ...x, path: rel, name: basename(rel), language: detectLanguage(rel), isDirty: false } : x))

        );

        setActiveTabPath(rel);

        continue;

      }

      await workspaceWriteFile(t.path, t.content);

      setTabs((prev) => prev.map((x) => (x.path === t.path ? { ...x, isDirty: false } : x)));

    }

  }, [requestRelativePath, tabs]);



  const saveAs = useCallback(async () => {

    if (!activeTab) return;

    if (activeTab.kind === "image") {

      if (!workspace.root) {

        await openFolder();

        if (!workspace.root) return;

      }

      const dataUrl = activeTab.image?.dataUrl;

      if (!dataUrl) {

        notifyRef.current?.({ kind: "error", title: "Export image failed", message: "No edited image data to export." });

        return;

      }

      const name = await requestRelativePath("Export image", activeTab.name, {

        subtitle: "Export relative to the workspace root",

        placeholder: "folder/image",

        extensions: ["png", "jpg", "webp"],

        defaultExtension: "png",

        enforceExtension: true,

      });

      if (!name) return;

      const rel = name.trim().replace(/\\/g, "/");

      if (!rel) return;

      await workspaceWriteFileBase64(rel, dataUrl);

      await refreshDir(rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : undefined);

      return;

    }

    if (!workspace.root) {

      await openFolder();

      if (!workspace.root) return;

    }

    const name = await requestRelativePath("Save As", activeTab.name, {

      subtitle: "Save relative to the workspace root",

      placeholder: "folder/file",

      extensions: ["txt", "md", "json", "ts", "tsx", "js", "jsx", "css", "html"],

    });

    if (!name) return;

    const rel = name.trim().replace(/\\/g, "/");

    if (!rel) return;

    await workspaceWriteFile(rel, activeTab.content);

    setTabs((prev) => {

      const without = prev.filter((t) => t.path !== activeTab.path);

      const next: EditorTab = {

        path: rel,

        name: basename(rel),

        language: detectLanguage(rel),

        content: activeTab.content,

        isDirty: false,

      };

      return [...without, next];

    });

    setActiveTabPath(rel);

    await refreshDir(rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : undefined);

  }, [activeTab, openFolder, refreshDir, requestRelativePath, workspace.root]);



  const revertFile = useCallback(async () => {

    if (!activeTab) return;

    if (activeTab.path.startsWith("untitled:")) {

      const ok = await requestConfirm("Revert", "Revert will close this untitled file. Continue?", { danger: true, confirmLabel: "Revert" });

      if (!ok) return;

      void closeTab(activeTab.path);

      return;

    }



    if (activeTab.kind === "image") {

      await refreshImageTab(activeTab.path);

      return;

    }

    const content = await workspaceReadFile(activeTab.path);

    setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, content, isDirty: false } : t)));

  }, [activeTab, closeTab, refreshImageTab, requestConfirm]);



  const saveWorkspaceAs = useCallback(async () => {

    if (!workspace.root) {

      notify({ kind: "info", title: "Workspace", message: "No folder is open. Open a folder first." });

      return;

    }



    const initial = workspace.root.split("/").filter(Boolean).slice(-1)[0] ?? "workspace";

    const name = await requestTextPrompt("Save workspace", initial, { subtitle: "Name this workspace" });

    if (!name) return;

    const trimmed = String(name).trim();

    if (!trimmed) return;

    const existing = getSavedWorkspaces();

    const exists = existing.find((x) => x.name.trim().toLowerCase() === trimmed.toLowerCase());

    if (exists) {

      const ok = await requestConfirm("Overwrite workspace", `A workspace named "${trimmed}" already exists. Overwrite?`, { confirmLabel: "Overwrite" });

      if (!ok) return;

    }

    const now = Date.now();

    const roots = (workspace.roots && workspace.roots.length ? workspace.roots : workspace.root ? [workspace.root] : []).map((r) => String(r || "").trim()).filter(Boolean);

    const next = [{ name: trimmed, roots, updated_at: now }, ...existing.filter((x) => x.name.trim().toLowerCase() !== trimmed.toLowerCase())];

    await persistSavedWorkspaces(next);

    notify({ kind: "info", title: "Workspace", message: `Saved "${trimmed}".` });

  }, [getSavedWorkspaces, notify, persistSavedWorkspaces, requestConfirm, requestTextPrompt, workspace.root, workspace.roots]);



  const duplicateWorkspace = useCallback(async () => {

    await saveWorkspaceAs();

  }, [saveWorkspaceAs]);



  const openRecentFile = useCallback(

    async (absPath: string) => {

      const file = absPath.replace(/\\/g, "/");

      const root = dirname(file);

      const w = await workspaceSet(root);

      setWorkspaceState(w);

      setSettingsState((s) => ({

        ...s,

        workspace_root: w.root,

        recent_workspaces: w.recent,

      }));

      setTabs((prev) => {

        prev.forEach(revokeTabObjectUrl);

        return [];

      });

      setActiveTabPath(null);

      await refreshRoot();

      await openFile(basename(file));

      rememberRecentFile(file);

    },

    [openFile, refreshRoot, rememberRecentFile]

  );



  const closeFolder = useCallback(async () => {

    const ok = await requestConfirm("Close folder", "Are you sure you want to close the current folder?", { confirmLabel: "Close" });

    if (!ok) return;

    const w = await workspaceSet(null);

    setWorkspaceState(w);

    setSettingsState((s) => ({

      ...s,

      workspace_root: w.root,

      recent_workspaces: w.recent,

    }));

    setTabs((prev) => {

      prev.forEach(revokeTabObjectUrl);

      return [];

    });

    setActiveTabPath(null);

    setExplorer({});

    setExpandedDirs(new Set());

    setSelectedPath(null);

  }, []);



  const exitApp = useCallback(() => {

    try {

      void getCurrentWindow().close().catch(() => {

        window.close();

      });

    } catch {

      window.close();

    }

  }, []);



  const minimizeApp = useCallback(() => {

    try {

      void getCurrentWindow().minimize().catch(() => {

      });

    } catch {

    }

  }, []);



  const toggleMaximizeApp = useCallback(() => {

    try {

      void getCurrentWindow().toggleMaximize().catch(() => {

      });

    } catch {

    }

  }, []);



  const toggleFullscreenApp = useCallback(() => {

    try {

      void getCurrentWindow()

        .isFullscreen()

        .then((v) => getCurrentWindow().setFullscreen(!v))

        .catch(() => {

        });

    } catch {

    }

  }, []);



  const onHeaderMouseDown = useCallback((e: ReactMouseEvent<HTMLElement>) => {

    if (e.button !== 0) return;

    const t = e.target as HTMLElement | null;

    if (!t) return;

    if (t.closest('button,a,input,textarea,select,[data-no-drag="true"]')) return;

    try {

      void getCurrentWindow().startDragging().catch(() => {

      });

    } catch {

    }

  }, []);



  const isMac = useMemo(() => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent), []);

  const isWindows = useMemo(() => /Windows/i.test(navigator.userAgent), []);



  useEffect(() => {

    if (isMac) return;

    try {

      const w = getCurrentWindow();

      // On Windows, the native window shadow/frame can appear as a thick outline.

      // Disable shadow there to remove the outer border.

      void w.setShadow(!isWindows).catch(() => {

      });

    } catch {

    }

  }, [isMac, isWindows]);



  const toggleTheme = useCallback(() => {

    setSettingsState((s) => {

      const next: AppSettings = { ...s, theme: s.theme === "dark" ? "light" : "dark" };

      void settingsSet(next).catch((e) => devConsoleError("Failed to save theme", e));

      return next;

    });

  }, [devConsoleError]);



  const setCursorBlinking = useCallback(

    async (v: CursorBlinking) => {

      const next: AppSettings = { ...settings, editor_cursor_blinking: v };

      setSettingsState(next);

      try {

        await settingsSet(next);

      } catch (e) {

        devConsoleError("Failed to save cursor blinking", e);

        notify({ kind: "error", title: "Settings", message: `Failed to save cursor blinking: ${formatErr(e)}` });

      }

    },

    [devConsoleError, formatErr, notify, settings]

  );



  const setLineHighlightColor = useCallback(

    async (hex: string | null) => {

      const next: AppSettings = { ...settings, editor_line_highlight_color: hex };

      setSettingsState(next);

      try {

        await settingsSet(next);

      } catch (e) {

        devConsoleError("Failed to save line highlight color", e);

        notify({ kind: "error", title: "Settings", message: `Failed to save line highlight color: ${formatErr(e)}` });

      }

    },

    [devConsoleError, formatErr, notify, settings]

  );



  const setCursorColor = useCallback(

    async (hex: string | null) => {

      const next: AppSettings = { ...settings, editor_cursor_color: hex };

      setSettingsState(next);

      try {

        await settingsSet(next);

      } catch (e) {

        devConsoleError("Failed to save cursor color", e);

        notify({ kind: "error", title: "Settings", message: `Failed to save cursor color: ${formatErr(e)}` });

      }

    },

    [devConsoleError, formatErr, notify, settings]

  );



  const setKeybindings = useCallback(

    async (nextKeybindings: Record<string, string>) => {

      const seq = (settingsMutationSeqRef.current += 1);

      const prev = settings;

      const merged = { ...DEFAULT_KEYBINDINGS, ...(nextKeybindings ?? {}) };

      const next: AppSettings = { ...settings, keybindings: merged };

      setSettingsState(next);

      try {

        await settingsSet(next);

      } catch (e) {

        devConsoleError("Failed to save keybindings", e);

        notify({ kind: "error", title: "Settings", message: `Failed to save shortcuts: ${formatErr(e)}` });

        if (settingsMutationSeqRef.current === seq) {

          setSettingsState(prev);

        }

      }

    },

    [devConsoleError, formatErr, notify, settings]

  );



  const changeProvider = useCallback(

    async (p: string | null) => {

      const seq = (settingsMutationSeqRef.current += 1);

      setKeyStatus(null);

      setShowKeySaved(false);

      setShowKeyCleared(false);



      const next = {

        ...settings,

        active_provider: p,

        // If the provider changes, the previously selected model may be invalid for the new provider.

        active_model: p && p === settings.active_provider ? settings.active_model : null,

      };

      setSettingsState(next);



      try {

        await settingsSet(next);

        if (p) {

          const keyStatus = await providerKeyStatus(p);

          setKeyStatus(keyStatus);

          // Load models if key is configured

          const provider = providerChoices.find((x) => x.id === p);

          if (provider?.api && keyStatus.is_configured) {

            await loadProviderModels(p);

          }

        }

      } catch (e) {

        devConsoleError("Failed to save provider selection", e);

        setSecretsError(String(e));

        if (settingsMutationSeqRef.current === seq) {

          // Don't let an older failure clobber a newer successful selection.

          setSettingsState(settings);

        }

      }

    },

    [devConsoleError, settings, providerChoices, loadProviderModels]

  );



  const saveSettingsNow = useCallback(async () => {

    if (isSavingSettings) return;

    setIsSavingSettings(true);

    try {

      await settingsSet(settings);

    } catch (e) {

      devConsoleError("Failed to save settings", e);

      notify({ kind: "error", title: "Settings", message: "Failed to save settings" });

    } finally {

      setIsSavingSettings(false);

    }

  }, [devConsoleError, isSavingSettings, notify, settings]);



  const toggleOfflineMode = useCallback(async () => {

    if (isTogglingOffline) return;

    setIsTogglingOffline(true);

    const next: AppSettings = { ...settings, offline_mode: !settings.offline_mode };

    setSettingsState(next);

    try {

      await settingsSet(next);

    } catch (e) {

      devConsoleError("Failed to toggle offline mode", e);

      notify({ kind: "error", title: "Settings", message: "Failed to toggle offline mode" });

      setSettingsState(settings);

    } finally {

      setIsTogglingOffline(false);

    }

  }, [devConsoleError, isTogglingOffline, notify, settings]);



  const setPomporaThinking = useCallback(

    async (thinking: string | null) => {

      const seq = (settingsMutationSeqRef.current += 1);

      const next: AppSettings = { ...settings, pompora_thinking: thinking };

      setSettingsState(next);

      try {

        await settingsSet(next);

      } catch (e) {

        devConsoleError("Failed to save pompora thinking", e);

        notify({ kind: "error", title: "Settings", message: `Failed to save thinking mode: ${formatErr(e)}` });

        if (settingsMutationSeqRef.current === seq) {

          setSettingsState(settings);

        }

      }

    },

    [devConsoleError, formatErr, notify, settings]

  );



  const selectPomporaMode = useCallback(

    async (mode: "slow" | "fast" | "reasoning") => {

      const seq = (settingsMutationSeqRef.current += 1);

      const prev = settings;

      setUiPomporaThinking(mode);

      const next: AppSettings = { ...settings, active_provider: "pompora", pompora_thinking: mode };

      setSettingsState(next);

      try {

        await settingsSet(next);

        try {

          setKeyStatus(await providerKeyStatus("pompora"));

        } catch {

        }

      } catch (e) {

        devConsoleError("Failed to select pompora mode", e);

        notify({ kind: "error", title: "Settings", message: `Failed to save thinking mode: ${formatErr(e)}` });

        if (settingsMutationSeqRef.current === seq) {

          setSettingsState(prev);

          setUiPomporaThinking(

            prev.active_provider === "pompora" ? (String(prev.pompora_thinking ?? "slow").toLowerCase() as "slow" | "fast" | "reasoning") : null

          );

        }

      }

    },

    [devConsoleError, formatErr, notify, settings]

  );



  const handleStoreKey = useCallback(async () => {

    if (!settings.active_provider) return;

    if (settings.active_provider === "pompora") return;

    if (!apiKeyDraft.trim()) return;

    setIsKeyOperationInProgress(true);

    setSecretsError(null);

    try {

      await providerKeySet({

        provider: settings.active_provider,

        apiKey: apiKeyDraft.trim(),

        encryptionPassword: encryptionPasswordDraft ? encryptionPasswordDraft.trim() : undefined,

      });

      setShowKeySaved(true);

      setTimeout(() => setShowKeySaved(false), 2000);

      const newKeyStatus = await providerKeyStatus(settings.active_provider);

      setKeyStatus(newKeyStatus);

      // Load models after saving API key

      if (newKeyStatus.is_configured) {

        await refreshProviderKeyStatuses();

        await loadProviderModels(settings.active_provider);

      }

    } catch (e) {

      devConsoleError(e);

      setSecretsError(String(e));

    } finally {

      setIsKeyOperationInProgress(false);

    }

  }, [apiKeyDraft, devConsoleError, encryptionPasswordDraft, settings.active_provider, refreshProviderKeyStatuses, loadProviderModels]);



  const clearProviderKey = useCallback(async () => {

    if (!settings.active_provider) return;

    if (settings.active_provider === "pompora") return;

    setIsKeyOperationInProgress(true);

    setSecretsError(null);

    try {

      await providerKeyClear(settings.active_provider);

      setShowKeyCleared(true);

      setTimeout(() => setShowKeyCleared(false), 2000);

      setKeyStatus(await providerKeyStatus(settings.active_provider));

    } catch (e) {

      devConsoleError(e);

      setSecretsError(String(e));

    } finally {

      setIsKeyOperationInProgress(false);

    }

  }, [devConsoleError, settings.active_provider]);



  const handleDebugGemini = useCallback(async () => {

    if (!settings.active_provider) return;

    setIsKeyOperationInProgress(true);

    setSecretsError(null);

    setDebugResult("Running debug test...");

    try {

      const out = await debugGeminiEndToEnd(apiKeyDraft.trim());

      setDebugResult(out);

    } catch (e) {

      setDebugResult(String(e));

    } finally {

      setIsKeyOperationInProgress(false);

    }

  }, [apiKeyDraft, settings.active_provider]);



  const sendChat = useCallback(async () => {

    const text = activeChat.draft.trim();

    if (!text) return;

    if (!settings.active_provider) return;

    if (settings.offline_mode) return;



    let agentRunId: string | null = null;



    if (aiBlockedReason) {

      notify({ kind: "info", title: "Action required", message: aiBlockedReason });

      if (!settings.active_provider) {

        setIsModelPickerOpen(true);

      } else {

        openSettingsTab();

      }

      return;

    }



    if (activeChat.messages.length === 0 && /^Chat\s+\d+$/i.test(activeChat.title)) {

      setActiveChatTitle(deriveChatTitleFromPrompt(text));

    }



    setChatBusy(true);



    let encryptionPassword: string | undefined;

    if (providerNeedsKey && keyStatus?.storage === "encryptedfile") {

      const pw = await requestTextPrompt("Encryption password", "", {

        subtitle: "Enter password to use your stored provider key",

        placeholder: "Password",

        password: true,

      });

      if (!pw) {

        setChatBusy(false);

        return;

      }

      encryptionPassword = pw;

    }



    try {

      const previous = (chatMessagesRef.current ?? []).filter((m) => m.role !== "meta");

      const base = [...previous, { role: "user" as const, content: text }];

      setActiveChatDraft("");



      const hasCachedIndex = Boolean(workspace.root && fileIndexRoot === workspace.root && fileIndex.length);

      const workspaceFiles = hasCachedIndex ? fileIndex : [];

      if (workspace.root && !hasCachedIndex) {

        void ensureFileIndex();

      }



      const workspaceTree = workspaceFiles.length ? buildFileTreePreview(workspaceFiles, 240, 7) : "";



      const explicitRefs = workspace.root ? extractFileRefs(text) : [];

      const recentChangeFiles =

        workspace.root && activeChat.changeSet

          ? activeChat.changeSet.files

              .filter((f) => f.kind === "write" && typeof f.path === "string")

              .map((f) => f.path)

              .slice(0, 4)

          : [];

      const autoRefs = workspace.root && activeTab?.path ? [activeTab.path] : [];



      const defaultRefs = workspace.root ? pickDefaultContextFiles(workspaceFiles, activeTab?.path) : [];



      const referencedFiles =

        workspace.root

          ? Array.from(new Set([...explicitRefs, ...autoRefs, ...recentChangeFiles, ...defaultRefs])).slice(0, 12)

          : [];

      agentRunId = `es-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      activeEventStreamIdRef.current = agentRunId;



      const eventStreamMessage: ChatUiMessage = {

        id: agentRunId,

        role: "assistant",

        content: "",

        kind: "event_stream",

        eventStream: {

          status: "running",

          events: [],

        },

      };



      setActiveChatMessages([...base, eventStreamMessage]);



      const fileContexts: Array<{ path: string; content: string; truncated: boolean }> = [];

      for (const p of referencedFiles) {

        appendEventStream(agentRunId, [{ type: "state", content: `Checking ${p}…`, ttlMs: 900 }]);

        try {

          const max = 8000;

          const pending =

            activeChat.changeSet?.files.find(

              (f) => f.kind === "write" && f.path === p && typeof f.after === "string"

            ) ?? null;



          const content = pending ? String(pending.after || "") : await workspaceReadFile(p);

          const truncated = content.length > max;

          fileContexts.push({ path: p, content: truncated ? content.slice(0, max) : content, truncated });

        } catch {

          appendEventStream(agentRunId, [{ type: "state", content: `Couldn’t read ${p}.`, ttlMs: 1200 }]);

        }

      }



      const recentMetaLines = (activeChat.logs ?? [])

        .slice(-24)

        .map((l) => {

          const base = `${l.title}`.trim();

          const detail = (l.details ?? []).slice(-1)[0];

          return detail ? `${base} · ${detail}` : base;

        })

        .filter(Boolean)

        .slice(-16);



      const conversationForModel = base

        .filter(isUserOrAssistantMessage)

        .filter((m) => String(m.content || "").trim().length > 0)

        .filter((m) => !(m.role === "assistant" && m.kind === "run_request"));



      const systemPrompt =

        "You are a coding assistant inside an editor. Be direct and helpful.\n" +

        "IMPORTANT: Respond ONLY with a single valid JSON object (no markdown, no code fences).\n" +

        "Schema: {\"assistant_message\": string, \"edits\": [{\"op\": \"write\"|\"patch\"|\"delete\"|\"rename\"|\"run\", \"path\"?: string, \"content\"?: string, \"from\"?: string, \"to\"?: string}], \"summary\"?: string }.\n" +

        "Never put code in assistant_message; code must only appear inside edits[].content.\n" +

        "If you have no edits, return {\"assistant_message\": <answer>, \"edits\": []}.\n" +

        "If a workspace is open, you already have the folder tree + file list + selected file contents; do not ask the user to provide the structure again unless absolutely necessary.\n";



      const aiMessages: AiChatMessage[] = [

        { role: "system", content: systemPrompt },

        ...(workspace.root

          ? ([

              {

                role: "system" as const,

                content:

                  "Workspace context:\n" +

                  `- root: ${basename(workspace.root)}\n` +

                  `- files_indexed: ${workspaceFiles.length}\n` +

                  (workspaceTree ? "\nFolder tree (truncated):\n" + workspaceTree : ""),

              },

              ...(workspaceFiles.length

                ? ([

                    {

                      role: "system" as const,

                      content:

                        "File list (relative; truncated):\n" +

                        workspaceFiles

                          .slice(0, 220)

                          .map((p) => `- ${p}`)

                          .join("\n") +

                        (workspaceFiles.length > 220 ? "\n… (truncated)" : ""),

                    },

                  ] as AiChatMessage[])

                : ([] as AiChatMessage[])),

            ] as AiChatMessage[])

          : ([] as AiChatMessage[])),

        ...(fileContexts.length

          ? ([

              {

                role: "system" as const,

                content:

                  "Workspace file context (use this exact content for patches; if truncated, request a read of the full file):\n\n" +

                  fileContexts

                    .map((f) => `FILE: ${f.path}${f.truncated ? " (TRUNCATED)" : ""}\n---\n${f.content}\n---`)

                    .join("\n\n"),

              },

            ] as AiChatMessage[])

          : ([] as AiChatMessage[])),

        ...(recentMetaLines.length

          ? ([

              {

                role: "system" as const,

                content: "Recent IDE actions (already executed):\n" + recentMetaLines.map((l) => `- ${l}`).join("\n"),

              },

            ] as AiChatMessage[])

          : ([] as AiChatMessage[])),

        ...conversationForModel.map((m) => ({ role: m.role, content: m.content })),

      ];



      const requestOnce = async () => {

        const thinkingRaw = settings.active_provider === "pompora" ? (settings.pompora_thinking ?? uiPomporaThinking ?? "slow") : null;

        const thinking = thinkingRaw ? String(thinkingRaw).toLowerCase() : null;

        return await aiChat({ messages: aiMessages, encryptionPassword, thinking });

      };



      let res: Awaited<ReturnType<typeof requestOnce>>;

      try {

        res = await requestOnce();

      } catch (e) {

        const raw = String(e);

        if (/No content found in (API|Gemini API) response/i.test(raw)) {

          addLog({ kind: "info", title: "AI returned an empty response", status: "running", details: ["Retrying once…"] });

          res = await requestOnce();

        } else {

          throw e;

        }

      }

      const resEdits = (res as { edits?: AiEditOp[] | null }).edits;

      const rawOutPre = String((res as { output?: unknown }).output ?? "");

      const hasDirectEdits = Array.isArray(resEdits) && resEdits.length > 0;

      if (!hasDirectEdits && rawOutPre.trim().length === 0) {

        throw new Error("No content found in API response: <empty assistant output>");

      }

      const parsedFromText = tryParseEditsFromAssistantOutput(String(res.output ?? ""));



      const edits = Array.isArray(resEdits) && resEdits.length ? resEdits : parsedFromText?.edits ?? null;

      const rawOut = String(res.output ?? "");

      const assistantMsg = (parsedFromText?.message ?? rawOut.trim()).trim();



      const safeMsg = assistantMsg.length

        ? looksLikeCodeDump(assistantMsg)

          ? "I’m ready—tell me what you want to change and I’ll guide you step by step."

          : assistantMsg

        : "Ready.";



      const eventsFromModel = parsedFromText?.events ?? null;

      const parsedEvents = (eventsFromModel && eventsFromModel.length

        ? eventsFromModel

        : toChatEvents([{ type: "message", content: safeMsg || "Ready." }])) as ChatEvent[];



      updateEventStream(agentRunId, (es) => ({

        ...es,

        events: ([...(es.events ?? []), ...parsedEvents] as ChatEvent[]).slice(-240),

      }));



      if (edits && edits.length) {

        setChatApplying(true);



        appendEventStream(agentRunId, [{ type: "state", content: "Making changes…", ttlMs: 1200 }]);



        try {

          const norm = normalizeAiEdits(edits, workspace.root);

          const normalized = norm.edits;

          const changeSet = await buildChangeSet(normalized);

          setIsChatDockOpen(true);

          setActiveChatChangeSet(changeSet);



          const touchedFiles = changeSet.files

            .filter((f) => f.kind === "write" && typeof f.path === "string")

            .slice(0, 16)

            .map((f) => {

              const stats = computeFileEditStats(f);

              return { path: f.path, added: stats.added, removed: stats.removed };

            });

          if (touchedFiles.length) {

            appendEventStream(

              agentRunId,

              touchedFiles.map((f) => ({ type: "file_edit", file: f.path, added: f.added, removed: f.removed }))

            );

          }



          const first = changeSet.files.find((f) => f.kind === "write" && typeof f.path === "string") as ChangeFile | undefined;

          if (first?.kind === "write") {

            setSelectedChangePath(first.path);

            await openFile(first.path);

          }

        } finally {

          setChatApplying(false);

        }



        updateEventStream(agentRunId, (es) => ({ ...es, status: "done" }));

      } else {

        updateEventStream(agentRunId, (es) => ({ ...es, status: "done" }));

      }



      // If the active provider is Pompora, credits can change per request.

      if (settings.active_provider === "pompora") {

        try {

          const credits = await authGetCredits();

          setAuthCredits(credits);

        } catch {

        }

      }

    } catch (e) {

      const f = friendlyAiError(String(e));

      notify({ kind: "error", title: f.title, message: f.message });



      if (agentRunId) {

        appendEventStream(agentRunId, [{ type: "message", content: `${f.title}: ${f.message}` }]);

        updateEventStream(agentRunId, (es) => ({ ...es, status: "error" }));

      }

    } finally {

      setChatBusy(false);

    }

  }, [

    activeChat.draft,

    activeChat.messages.length,

    activeChat.title,

    activeTab,

    aiBlockedReason,

    authProfile,

    applyAiEditsNow,

    buildChangeSet,

    ensureFileIndex,

    fileIndex,

    fileIndexRoot,

    friendlyAiError,

    keyStatus?.storage,

    notify,

    openSettingsTab,

    openFile,

    providerNeedsKey,

    setIsModelPickerOpen,

    setActiveChatChangeSet,

    setActiveChatDraft,

    setActiveChatMessages,

    setActiveChatTitle,

    setSelectedChangePath,

    authGetCredits,

    settings.active_provider,

    settings.offline_mode,

    uiPomporaThinking,

    workspace.root,

    appendEventStream,

    updateEventStream,

  ]);



  const settingsProviderChoices = useMemo(

    () => providerChoices,

    [providerChoices]

  );



  useEffect(() => {

    sendChatRef.current = sendChat;

  }, [sendChat]);



  const kbRaw = useCallback(

    (id: string) => String(settings.keybindings?.[id] ?? DEFAULT_KEYBINDINGS[id] ?? ""),

    [settings.keybindings]

  );

  const kbNorm = useCallback((id: string) => __normShortcut(kbRaw(id)), [kbRaw]);



  const chatToggleNormRef = useRef<string>("");

  useEffect(() => {

    chatToggleNormRef.current = kbNorm("chat.toggle");

  }, [kbNorm]);



  const runEditorAction = useCallback(

    (actionId: string): boolean => {

      const ed = editorRef.current;

      if (!ed) return false;

      try {

        const act = ed.getAction(actionId);

        if (!act) return false;

        void act.run();

        return true;

      } catch {

        return false;

      }

    },

    []

  );



  const clipboardReadCacheRef = useRef<{ text: string; ts: number } | null>(null);



  const clipboardCopyFromEditor = useCallback(async (ed: any) => {

    console.log("[clipboardCopyFromEditor] called, ed:", !!ed);

    const model = ed?.getModel?.();

    const selections = ed?.getSelections?.() as any[] | null | undefined;

    console.log("[clipboardCopyFromEditor] model:", !!model, "selections:", selections?.length);

    if (!model || !selections || selections.length === 0) return;

    try {

      const parts = selections

        .map((sel) => {

          try {

            if (sel?.isEmpty?.()) return "";

            return model.getValueInRange(sel) as string;

          } catch {

            return "";

          }

        })

        .filter((x) => x !== "");

      const eol = typeof model?.getEOL === "function" ? (model.getEOL() as string) : "\n";

      const text = parts.join(eol);

      console.log("[clipboardCopyFromEditor] copying text:", text.length, "chars");

      // Try Tauri clipboard first, then WSL clipboard, then web API, then execCommand
      try {

        await clipboardWriteText(text);

        console.log("[clipboardCopyFromEditor] Tauri clipboard done");

      } catch (tauriErr) {

        console.log("[clipboardCopyFromEditor] Tauri clipboard failed, trying WSL clipboard:", tauriErr);

        try {

          await wslClipboardWriteText(text);

          console.log("[clipboardCopyFromEditor] WSL clipboard done");

        } catch (wslErr) {

          console.log("[clipboardCopyFromEditor] WSL clipboard failed, trying web API:", wslErr);

          if (navigator.clipboard && navigator.clipboard.writeText) {

            try {

              await navigator.clipboard.writeText(text);

              console.log("[clipboardCopyFromEditor] Web clipboard done");

            } catch (webErr) {

              console.log("[clipboardCopyFromEditor] Web clipboard failed, trying execCommand:", webErr);

              const textarea = document.createElement("textarea");

              textarea.value = text;

              textarea.style.position = "fixed";

              textarea.style.left = "-9999px";

              document.body.appendChild(textarea);

              textarea.select();

              document.execCommand("copy");

              document.body.removeChild(textarea);

              console.log("[clipboardCopyFromEditor] execCommand copy done");

            }

          } else {

            const textarea = document.createElement("textarea");

            textarea.value = text;

            textarea.style.position = "fixed";

            textarea.style.left = "-9999px";

            document.body.appendChild(textarea);

            textarea.select();

            document.execCommand("copy");

            document.body.removeChild(textarea);

            console.log("[clipboardCopyFromEditor] execCommand copy done");

          }

        }

      }

    } catch (e) {

      console.error("[clipboardCopyFromEditor] error:", e);

    }

  }, []);



  const clipboardCutFromEditor = useCallback(async (ed: any) => {

    const model = ed?.getModel?.();

    const selections = ed?.getSelections?.() as any[] | null | undefined;

    if (!model || !selections || selections.length === 0) return;

    const nonEmpty = selections.filter((s) => !s?.isEmpty?.());

    if (nonEmpty.length === 0) return;

    try {

      const parts = nonEmpty.map((sel) => model.getValueInRange(sel) as string);

      const eol = typeof model?.getEOL === "function" ? (model.getEOL() as string) : "\n";

      const text = parts.join(eol);

      // Try Tauri clipboard first, then WSL clipboard, then web API, then execCommand
      try {

        await clipboardWriteText(text);

      } catch (tauriErr) {

        console.log("[clipboardCutFromEditor] Tauri clipboard failed, trying WSL clipboard:", tauriErr);

        try {

          await wslClipboardWriteText(text);

        } catch (wslErr) {

          console.log("[clipboardCutFromEditor] WSL clipboard failed, trying web API:", wslErr);

          if (navigator.clipboard && navigator.clipboard.writeText) {

            try {

              await navigator.clipboard.writeText(text);

            } catch (webErr) {

              console.log("[clipboardCutFromEditor] Web clipboard failed, trying execCommand:", webErr);

              const textarea = document.createElement("textarea");

              textarea.value = text;

              textarea.style.position = "fixed";

              textarea.style.left = "-9999px";

              document.body.appendChild(textarea);

              textarea.select();

              document.execCommand("copy");

              document.body.removeChild(textarea);

            }

          } else {

            const textarea = document.createElement("textarea");

            textarea.value = text;

            textarea.style.position = "fixed";

            textarea.style.left = "-9999px";

            document.body.appendChild(textarea);

            textarea.select();

            document.execCommand("copy");

            document.body.removeChild(textarea);

          }

        }

      }

    } catch {

    }

    try {

      ed.pushUndoStop?.();

      const edits = nonEmpty.map((sel) => ({ range: sel, text: "" }));

      ed.executeEdits?.("clipboard", edits);

      ed.pushUndoStop?.();

    } catch {

    }

  }, []);



  const clipboardPasteIntoEditor = useCallback(async (ed: any) => {

    console.log("[clipboardPasteIntoEditor] called, ed:", !!ed);

    if (!ed) return;

    const cached = clipboardReadCacheRef.current;

    if (cached && Date.now() - cached.ts < 250) {

      const cachedText = cached.text;

      if (typeof cachedText === "string") {

        try {

          const sels = ed.getSelections?.() as any[] | null | undefined;

          if (!sels || sels.length === 0) return;

          ed.pushUndoStop?.();

          ed.executeEdits?.(

            "clipboard",

            sels.map((sel) => ({ range: sel, text: cachedText }))

          );

          ed.pushUndoStop?.();

          return;

        } catch {

        }

      }

    }

    let text: string | null = null;

    // Try Tauri clipboard first, then WSL clipboard, then web API
    try {

      text = await clipboardReadText();

      console.log("[clipboardPasteIntoEditor] Tauri read text:", text?.length, "chars");

    } catch (tauriErr) {

      console.log("[clipboardPasteIntoEditor] Tauri clipboard failed, trying WSL clipboard:", tauriErr);

      try {

        text = await wslClipboardReadText();

        console.log("[clipboardPasteIntoEditor] WSL read text:", text?.length, "chars");

      } catch (wslErr) {

        console.log("[clipboardPasteIntoEditor] WSL clipboard failed, trying web API:", wslErr);

        if (navigator.clipboard && navigator.clipboard.readText) {

          try {

            text = await navigator.clipboard.readText();

            console.log("[clipboardPasteIntoEditor] Web clipboard read:", text?.length, "chars");

          } catch (webErr) {

            console.log("[clipboardPasteIntoEditor] Web clipboard failed:", webErr);

          }

        }

      }

    }

    if (typeof text !== "string") {

      console.log("[clipboardPasteIntoEditor] No text from any clipboard API");

      return;

    }

    try {

      clipboardReadCacheRef.current = { text, ts: Date.now() };

    } catch {

    }

    try {

      const sels = ed.getSelections?.() as any[] | null | undefined;

      if (!sels || sels.length === 0) return;

      ed.pushUndoStop?.();

      ed.executeEdits?.(

        "clipboard",

        sels.map((sel) => ({ range: sel, text }))

      );

      ed.pushUndoStop?.();

      console.log("[clipboardPasteIntoEditor] executeEdits done");

    } catch (e) {

      console.log("[clipboardPasteIntoEditor] executeEdits failed:", e);

    }

  }, []);



  const selectAllInEditor = useCallback((ed: any) => {

    const model = ed?.getModel?.();

    if (!model) return;

    try {

      const full = model.getFullModelRange?.();

      if (full) {

        ed.setSelection?.(full);

        ed.revealRangeInCenterIfOutsideViewport?.(full);

        return;

      }

    } catch {

    }

    try {

      runEditCommand("selectAll");

    } catch {

    }

  }, [runEditCommand]);



  const bindMonacoShortcuts = useCallback(

    (ed: any) => {

      const monaco = monacoRef.current as any;

      if (!monaco || !ed?.addCommand) {
        console.log("[bindMonacoShortcuts] ABORT: monaco:", !!monaco, "ed?.addCommand:", !!ed?.addCommand);
        return;
      }
      console.log("[bindMonacoShortcuts] Binding shortcuts...");

      try {

        const km = monaco.KeyMod;

        const kc = monaco.KeyCode;

        // Use explicit Ctrl (2048) instead of CtrlCmd for Linux compatibility
        const Ctrl = 2048;

        console.log("[bindMonacoShortcuts] km.CtrlCmd:", km.CtrlCmd, "Ctrl:", Ctrl);

        ed.addCommand(Ctrl | kc.KeyA, () => {
          console.log("[Monaco] Ctrl+A TRIGGERED");
          selectAllInEditor(ed);
        });

        ed.addCommand(Ctrl | kc.KeyC, () => {
          console.log("[Monaco] Ctrl+C TRIGGERED");
          void clipboardCopyFromEditor(ed);
        });

        ed.addCommand(Ctrl | kc.KeyV, () => {
          console.log("[Monaco] Ctrl+V TRIGGERED");
          void clipboardPasteIntoEditor(ed);
        });

        ed.addCommand(Ctrl | kc.KeyX, () => {
          console.log("[Monaco] Ctrl+X TRIGGERED");
          void clipboardCutFromEditor(ed);
        });

        ed.addCommand(Ctrl | kc.Slash, () => {
          console.log("[Monaco] Ctrl+/ TRIGGERED");
          if (!runEditorAction("editor.action.commentLine")) runEditorAction("editor.action.toggleComment");
        });

        console.log("[bindMonacoShortcuts] Bound successfully with Ctrl:", Ctrl);

      } catch (e) {
        console.error("[bindMonacoShortcuts] ERROR:", e);
      }

    },

    [clipboardCopyFromEditor, clipboardCutFromEditor, clipboardPasteIntoEditor, runEditorAction, selectAllInEditor]

  );



  const focusTerminalPanel = useCallback(() => {

    setPanelTab("terminal");

    setIsTerminalOpen(true);

    window.setTimeout(() => {

      void ensureTerminal().then(() => {

        resizeTerminal();

      });

    }, 0);

  }, [ensureTerminal, resizeTerminal]);



  const focusProblemsPanel = useCallback(() => {

    setPanelTab("problems");

    setIsTerminalOpen(true);

  }, []);



  const focusOutputPanel = useCallback(() => {

    setPanelTab("output");

    setIsTerminalOpen(true);

  }, []);



  const focusDebugPanel = useCallback(() => {

    setPanelTab("debug");

    setIsTerminalOpen(true);

  }, []);



  const handleAppKeyDown = useCallback(

    (e: KeyboardEvent): boolean => {

      if ((window as any).__pomporaCapturingShortcut) {

        const captureActive = !!document.querySelector('[data-shortcut-capturing="true"]');

        if (!captureActive) (window as any).__pomporaCapturingShortcut = false;

        else return false;

      }



      const targetEl = e.target as HTMLElement | null;

      // When Monaco is focused, handle important Edit shortcuts using physical key codes.
      // This avoids layout issues and avoids being blocked by __eventToShortcut().
      const fromMonacoDom =

        !!targetEl && typeof (targetEl as any).closest === "function" && !!targetEl.closest(".monaco-editor");

      const fromMonaco = fromMonacoDom || !!editorRef.current?.hasTextFocus?.();

      if (fromMonaco) {

        const mod = e.ctrlKey;

        if (mod && !e.altKey) {

          if (!e.shiftKey && e.code === "KeyX") {

            e.preventDefault();

            e.stopPropagation();

            void clipboardCutFromEditor(editorRef.current);

            return true;

          }

          if (!e.shiftKey && e.code === "KeyC") {

            e.preventDefault();

            e.stopPropagation();

            void clipboardCopyFromEditor(editorRef.current);

            return true;

          }

          if (!e.shiftKey && e.code === "KeyV") {

            e.preventDefault();

            e.stopPropagation();

            void clipboardPasteIntoEditor(editorRef.current);

            return true;

          }

          if (!e.shiftKey && e.code === "KeyA") {

            e.preventDefault();

            e.stopPropagation();

            selectAllInEditor(editorRef.current);

            return true;

          }

          // Toggle line comment (Ctrl+/). Prefer physical key code, but also accept literal '/'
          // because some environments report non-standard codes.
          if (!e.shiftKey && (e.code === "Slash" || e.code === "NumpadDivide" || e.key === "/")) {

            e.preventDefault();

            e.stopPropagation();

            if (runEditorAction("editor.action.commentLine")) return true;

            // If Monaco doesn't have the action for some reason, let it handle the key.
            return false;

          }

        }

        // Toggle block comment (Shift+Alt+A)
        if (!mod && e.shiftKey && e.altKey && e.code === "KeyA") {

          e.preventDefault();

          e.stopPropagation();

          if (!runEditorAction("editor.action.blockComment")) {

            runEditorAction("editor.action.commentBlock");

          }

          return true;

        }

      }


      const evRaw = __eventToShortcut(e);

      if (!evRaw) return false;

      const ev = __normShortcut(evRaw);

      if (!ev) return false;

      // When Monaco is focused, it installs its own keydown handlers. Since this app listens
      // on window in capture phase, we'd otherwise handle shortcuts twice (window first,
      // then Monaco), which makes toggles look like no-ops.
      if (fromMonaco) {

        const editorOwned = new Set([

          kbNorm("chat.toggle"),

          kbNorm("edit.undo"),

          kbNorm("edit.redo"),

          kbNorm("view.navigateBack"),

          kbNorm("view.navigateForward"),

        ]);

        if (editorOwned.has(ev)) return false;

      }



      const chordState = (window as any).__pomporaChordSeq as { started: number; first: string } | null | undefined;

      if (chordState && Date.now() - chordState.started < 1500) {

        const seq = `${chordState.first} ${ev}`;

        if (seq === kbNorm("file.openFolder")) {

          e.preventDefault();

          (window as any).__pomporaChordSeq = null;

          void openFolder();

          return true;

        }

        if (seq === kbNorm("file.saveAll")) {

          e.preventDefault();

          (window as any).__pomporaChordSeq = null;

          void saveAll();

          return true;

        }

        if (seq === kbNorm("file.closeAll")) {

          e.preventDefault();

          (window as any).__pomporaChordSeq = null;

          closeAllTabs();

          return true;

        }

        if (seq === kbNorm("view.splitEditorInGroup")) {

          e.preventDefault();

          (window as any).__pomporaChordSeq = null;

          notify({ kind: "info", title: "Split Editor in Group", message: "Coming next." });

          return true;

        }

        if (seq === kbNorm("view.zenMode")) {

          e.preventDefault();

          (window as any).__pomporaChordSeq = null;

          notify({ kind: "info", title: "Zen Mode", message: "Coming next." });

          return true;

        }

      }

      if ((window as any).__pomporaChordSeq) (window as any).__pomporaChordSeq = null;



      const chordCandidates = [

        kbNorm("file.openFolder"),

        kbNorm("file.saveAll"),

        kbNorm("file.closeAll"),

        kbNorm("view.splitEditorInGroup"),

        kbNorm("view.zenMode"),

      ].filter((x) => x.includes(" "));

      for (const ch of chordCandidates) {

        const first = ch.split(" ")[0] ?? "";

        if (first && ev === first) {

          e.preventDefault();

          (window as any).__pomporaChordSeq = { started: Date.now(), first };

          return true;

        }

      }



      if (ev === kbNorm("chat.toggle")) {

        e.preventDefault();

        setIsChatDockOpen((v) => !v);

        return true;

      }



      if (ev === kbNorm("terminal.toggle")) {

        e.preventDefault();

        toggleTerminal();

        return true;

      }

      if (ev === kbNorm("view.commandPalette")) {

        e.preventDefault();

        setIsPaletteOpen(true);

        return true;

      }

      if (ev === kbNorm("file.quickOpen")) {

        e.preventDefault();

        void openQuickOpen();

        return true;

      }

      if (ev === kbNorm("file.openFile")) {

        e.preventDefault();

        void openStandaloneFile();

        return true;

      }

      if (ev === kbNorm("editor.gotoLine")) {

        e.preventDefault();

        openGoToLine();

        return true;

      }

      if (ev === kbNorm("workbench.findInFiles")) {

        e.preventDefault();

        setActivity("search");

        return true;

      }

      if (ev === kbNorm("workbench.replaceInFiles")) {

        e.preventDefault();

        setActivity("search");

        notify({ kind: "info", title: "Replace in Files", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.search")) {

        e.preventDefault();

        setActivity("search");

        return true;

      }

      if (ev === kbNorm("view.explorer")) {

        e.preventDefault();

        setActivity("explorer");

        return true;

      }

      if (ev === kbNorm("view.sourceControl")) {

        e.preventDefault();

        setActivity("scm");

        return true;

      }

      if (ev === kbNorm("view.runDebug")) {

        e.preventDefault();

        notify({ kind: "info", title: "Run & Debug", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.extensions")) {

        e.preventDefault();

        notify({ kind: "info", title: "Extensions", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("panel.problems")) {

        e.preventDefault();

        focusProblemsPanel();

        return true;

      }

      if (ev === kbNorm("panel.output")) {

        e.preventDefault();

        focusOutputPanel();

        return true;

      }

      if (ev === kbNorm("panel.debugConsole")) {

        e.preventDefault();

        focusDebugPanel();

        return true;

      }

      if (ev === kbNorm("terminal.new") || ev === kbNorm("terminal.split") || ev === kbNorm("terminal.newWindow")) {

        e.preventDefault();

        focusTerminalPanel();

        if (ev === kbNorm("terminal.newWindow")) {

          notify({ kind: "info", title: "New Terminal Window", message: "Coming next." });

        }

        return true;

      }

      if (ev === kbNorm("view.fullScreen")) {

        e.preventDefault();

        toggleFullscreenApp();

        return true;

      }

      if (ev === kbNorm("view.primarySidebar")) {

        e.preventDefault();

        notify({ kind: "info", title: "Primary Sidebar", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.zoomIn")) {

        e.preventDefault();

        notify({ kind: "info", title: "Zoom In", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.zoomOut")) {

        e.preventDefault();

        notify({ kind: "info", title: "Zoom Out", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.zoomReset")) {

        e.preventDefault();

        notify({ kind: "info", title: "Reset Zoom", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.splitEditor")) {

        e.preventDefault();

        notify({ kind: "info", title: "Split Editor", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.flipLayout")) {

        e.preventDefault();

        notify({ kind: "info", title: "Flip Layout", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("view.settings")) {

        e.preventDefault();

        openSettingsTab();

        return true;

      }

      if (ev === kbNorm("view.navigateBack")) {

        e.preventDefault();

        goBack();

        return true;

      }

      if (ev === kbNorm("view.navigateForward")) {

        e.preventDefault();

        goForward();

        return true;

      }

      if (ev === kbNorm("file.saveAs")) {

        e.preventDefault();

        void saveAs();

        return true;

      }

      if (ev === kbNorm("file.save")) {

        e.preventDefault();

        void saveActiveFile();

        return true;

      }

      if (ev === kbNorm("file.newWindow")) {

        e.preventDefault();

        openNewWindow();

        return true;

      }

      if (ev === kbNorm("file.close")) {

        if (activeTab) {

          e.preventDefault();

          closeTab(activeTab.path);

          return true;

        }

        return false;

      }

      if (ev === kbNorm("window.close")) {

        e.preventDefault();

        exitApp();

        return true;

      }

      if (ev === kbNorm("edit.undo")) {

        e.preventDefault();

        if (!runEditorAction("undo")) void runEditorAction("editor.action.undo");

        return true;

      }

      if (ev === kbNorm("edit.redo")) {

        e.preventDefault();

        if (!runEditorAction("redo")) void runEditorAction("editor.action.redo");

        return true;

      }

      if (ev === __normShortcut("Ctrl+Shift+Z")) {

        e.preventDefault();

        if (!runEditorAction("redo")) void runEditorAction("editor.action.redo");

        return true;

      }

      if (ev === kbNorm("edit.cut")) {

        e.preventDefault();

        document.execCommand("cut");

        return true;

      }

      if (ev === kbNorm("edit.copy")) {

        e.preventDefault();

        document.execCommand("copy");

        return true;

      }

      if (ev === kbNorm("edit.paste")) {

        e.preventDefault();

        document.execCommand("paste");

        return true;

      }

      if (ev === kbNorm("edit.selectAll")) {

        e.preventDefault();

        if (!runEditorAction("editor.action.selectAll")) document.execCommand("selectAll");

        return true;

      }

      if (ev === kbNorm("find.find")) {

        e.preventDefault();

        runEditorAction("actions.find");

        return true;

      }

      if (ev === kbNorm("find.replace")) {

        e.preventDefault();

        runEditorAction("editor.action.startFindReplaceAction");

        return true;

      }

      if (ev === kbNorm("editor.toggleLineComment")) {

        e.preventDefault();

        runEditorAction("editor.action.commentLine");

        return true;

      }

      if (ev === kbNorm("editor.toggleBlockComment")) {

        e.preventDefault();

        runEditorAction("editor.action.blockComment");

        return true;

      }

      if (ev === kbNorm("editor.expandSelection")) {

        e.preventDefault();

        runEditorAction("editor.action.smartSelect.expand");

        return true;

      }

      if (ev === kbNorm("editor.copyLineUp")) {

        e.preventDefault();

        runEditorAction("editor.action.copyLinesUpAction");

        return true;

      }

      if (ev === kbNorm("editor.copyLineDown")) {

        e.preventDefault();

        runEditorAction("editor.action.copyLinesDownAction");

        return true;

      }

      if (ev === kbNorm("editor.moveLineUp")) {

        e.preventDefault();

        runEditorAction("editor.action.moveLinesUpAction");

        return true;

      }

      if (ev === kbNorm("editor.moveLineDown")) {

        e.preventDefault();

        runEditorAction("editor.action.moveLinesDownAction");

        return true;

      }

      if (ev === kbNorm("editor.addCursorAbove")) {

        e.preventDefault();

        runEditorAction("editor.action.insertCursorAbove");

        return true;

      }

      if (ev === kbNorm("editor.addCursorBelow")) {

        e.preventDefault();

        runEditorAction("editor.action.insertCursorBelow");

        return true;

      }

      if (ev === kbNorm("editor.addCursorsToLineEnds")) {

        e.preventDefault();

        runEditorAction("editor.action.insertCursorAtEndOfEachLineSelected");

        return true;

      }

      if (ev === kbNorm("editor.selectAllOccurrences")) {

        e.preventDefault();

        runEditorAction("editor.action.selectHighlights");

        return true;

      }

      if (ev === kbNorm("editor.toggleWordWrap")) {

        e.preventDefault();

        runEditorAction("editor.action.toggleWordWrap");

        return true;

      }

      if (ev === kbNorm("emmet.expandAbbreviation")) {

        // Let Tab behave normally for editor/inputs.

        return false;

      }

      if (ev === kbNorm("debug.start") || ev === kbNorm("debug.runWithout") || ev === kbNorm("debug.stop") || ev === kbNorm("debug.restart")) {

        e.preventDefault();

        notify({ kind: "info", title: "Debug", message: "Coming next." });

        return true;

      }

      if (ev === kbNorm("tasks.build")) {

        e.preventDefault();

        notify({ kind: "info", title: "Build Task", message: "Coming next." });

        return true;

      }



      if (e.key === "Escape") {

        setIsPaletteOpen(false);

        setIsQuickOpenOpen(false);

        setIsGoToLineOpen(false);

        setExplorerMenu(null);

        setIsFileMenuOpen(false);

        setIsFileMenuRecentOpen(false);

        return true;

      }



      return false;

    },

    [

      activeTab,

      closeAllTabs,

      closeTab,

      ensureTerminal,

      kbNorm,

      openFolder,

      openGoToLine,

      openNewWindow,

      openQuickOpen,

      openSettingsTab,

      openStandaloneFile,

      focusDebugPanel,

      focusOutputPanel,

      focusProblemsPanel,

      focusTerminalPanel,

      notify,

      resizeTerminal,

      runEditorAction,

      saveActiveFile,

      saveAll,

      saveAs,

      setActivity,

      setIsChatDockOpen,

      toggleTerminal,

      toggleFullscreenApp,

      exitApp,

    ]

  );



  const commands = useMemo<Command[]>(() => {

    const c: Command[] = [

      { id: "file.openFolder", label: "File: Open Folder...", shortcut: kbRaw("file.openFolder"), run: () => void openFolder() },

      { id: "file.openFile", label: "File: Open File...", shortcut: "Ctrl+O", run: () => void openStandaloneFile() },

      { id: "file.quickOpen", label: "File: Quick Open...", shortcut: kbRaw("file.quickOpen"), run: () => void openQuickOpen() },

      { id: "editor.gotoLine", label: "Go: Go to Line...", shortcut: kbRaw("editor.gotoLine"), run: () => openGoToLine() },

      { id: "file.newFolder", label: "File: New Folder...", run: () => void createNewFolder() },

      { id: "file.rename", label: "File: Rename...", run: () => void renameSelected() },

      { id: "file.delete", label: "File: Delete", run: () => void deleteSelected() },

      { id: "file.save", label: "File: Save", shortcut: kbRaw("file.save"), run: () => void saveActiveFile() },

      { id: "file.saveAll", label: "File: Save All", shortcut: kbRaw("file.saveAll"), run: () => void saveAll() },

      { id: "file.closeAll", label: "File: Close All Editors", shortcut: kbRaw("file.closeAll"), run: () => closeAllTabs() },

      { id: "view.commandPalette", label: "View: Show Command Palette", shortcut: kbRaw("view.commandPalette"), run: () => setIsPaletteOpen(true) },

      { id: "workbench.findInFiles", label: "Search: Find in Files", shortcut: kbRaw("workbench.findInFiles"), run: () => setActivity("search") },

      { id: "view.toggleTheme", label: "Preferences: Toggle Theme", run: () => toggleTheme() },

      { id: "view.settings", label: "Preferences: Open Settings", shortcut: kbRaw("view.settings"), run: () => openSettingsTab() },

      { id: "workbench.focusExplorer", label: "View: Focus Explorer", run: () => setActivity("explorer") },

    ];



    if (activeTab) {

      c.push({

        id: "file.closeActive",

        label: "File: Close Active Editor",

        shortcut: "Ctrl+W",

        run: () => closeTab(activeTab.path),

      });

    }



    return c;

  }, [activeTab, closeAllTabs, closeTab, createNewFolder, deleteSelected, kbRaw, openFolder, openGoToLine, openQuickOpen, openSettingsTab, openStandaloneFile, renameSelected, saveActiveFile, saveAll, setIsPaletteOpen, setActivity, toggleTheme]);



  const filteredCommands = useMemo(() => {

    const q = paletteQuery.trim().toLowerCase();

    if (!q) return commands;

    return commands.filter((x) => x.label.toLowerCase().includes(q));

  }, [commands, paletteQuery]);



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      handleAppKeyDown(e);

    };



    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);

  }, [handleAppKeyDown]);



  useEffect(() => {

    if (!explorerMenu) return;

    const onMouseDown = () => setExplorerMenu(null);

    window.addEventListener("mousedown", onMouseDown);

    return () => window.removeEventListener("mousedown", onMouseDown);

  }, [explorerMenu]);



  useEffect(() => {

    if (!anyMenubarOpen) return;



    const onMouseDown = (e: MouseEvent) => {

      const t = e.target as HTMLElement | null;

      if (!t) return;

      if (!t.closest("[data-menubar-root]")) {

        closeMenubarMenus();

      }

    };



    window.addEventListener("mousedown", onMouseDown);

    return () => window.removeEventListener("mousedown", onMouseDown);

  }, [anyMenubarOpen, closeMenubarMenus]);



  const copyText = useCallback(async (text: string) => {

    try {

      await navigator.clipboard.writeText(text);

    } catch {

      await requestTextPrompt("Copy to clipboard", text, { readOnly: true, showCopy: true });

    }

  }, [requestTextPrompt]);



  useEffect(() => {

    if (!isPaletteOpen) {

      setPaletteQuery("");

      setPaletteIndex(0);

    }

  }, [isPaletteOpen]);



  useEffect(() => {

    if (!isQuickOpenOpen) {

      setQuickOpenQuery("");

      setQuickOpenIndex(0);

    }

  }, [isQuickOpenOpen]);



  useEffect(() => {

    const nav = tabNavRef.current;



    const computeAvail = () => {

      const isOpen = (p: string) => tabs.some((t) => t.path === p);

      let iBack = nav.index - 1;

      while (iBack >= 0 && !isOpen(nav.history[iBack]!)) iBack--;

      let iFwd = nav.index + 1;

      while (iFwd < nav.history.length && !isOpen(nav.history[iFwd]!)) iFwd++;

      setTabNavAvail({ back: iBack >= 0, forward: iFwd < nav.history.length });

    };



    if (!activeTabPath) {

      setTabNavAvail({ back: false, forward: false });

      return;

    }



    if (nav.suppress) {

      nav.suppress = false;

      computeAvail();

      return;

    }



    if (nav.index >= 0 && nav.history[nav.index] === activeTabPath) {

      computeAvail();

      return;

    }



    nav.history = nav.history.slice(0, Math.max(0, nav.index + 1));

    nav.history.push(activeTabPath);

    nav.index = nav.history.length - 1;

    computeAvail();

  }, [activeTabPath, tabs]);



  const goBack = useCallback(() => {

    const nav = tabNavRef.current;

    const isOpen = (p: string) => tabs.some((t) => t.path === p);

    let i = nav.index - 1;

    while (i >= 0 && !isOpen(nav.history[i]!)) i--;

    if (i < 0) return;

    nav.index = i;

    nav.suppress = true;

    setActiveTabPath(nav.history[i]!);

    setTabNavAvail({ back: i - 1 >= 0, forward: true });

  }, [tabs]);



  const goForward = useCallback(() => {

    const nav = tabNavRef.current;

    const isOpen = (p: string) => tabs.some((t) => t.path === p);

    let i = nav.index + 1;

    while (i < nav.history.length && !isOpen(nav.history[i]!)) i++;

    if (i >= nav.history.length) return;

    nav.index = i;

    nav.suppress = true;

    setActiveTabPath(nav.history[i]!);

    setTabNavAvail({ back: true, forward: i + 1 < nav.history.length });

  }, [tabs]);



  useEffect(() => {

    setPaletteIndex(0);

  }, [paletteQuery]);



  const applyMonacoThemes = useCallback((

    monaco: typeof import("monaco-editor"),

    lineHighlightColor: string | null,

    cursorColor: string | null

  ) => {

    const rawLine = String(lineHighlightColor ?? "").trim();

    const isLineHex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(rawLine);

    const darkLine = isLineHex ? rawLine : "#232228";

    const lightLine = isLineHex ? rawLine : "#F8FAFC";



    const rawCursor = String(cursorColor ?? "").trim();

    const isCursorHex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(rawCursor);

    const darkCursor = isCursorHex ? rawCursor : "#60D6AA";

    const lightCursor = isCursorHex ? rawCursor : "#059669";



    monaco.editor.defineTheme("pompora-dark", {

      base: "vs-dark",

      inherit: true,

      rules: [

        { token: "comment", foreground: "565F89", fontStyle: "italic" },

        { token: "keyword", foreground: "7AA2F7" },

        { token: "number", foreground: "FF9E64" },

        { token: "string", foreground: "9ECE6A" },

        { token: "type", foreground: "2AC3DE" },

        { token: "function", foreground: "BB9AF7" },

        { token: "tag", foreground: "F7768E" },

        { token: "attribute.name", foreground: "E0AF68" },

      ],

      colors: {

        "editor.background": "#1E1D20",

        "editor.foreground": "#E6E6EA",

        "editorLineNumber.foreground": "#5B5863",

        "editorLineNumber.activeForeground": "#C8C7CF",

        "editorCursor.foreground": darkCursor,

        "editor.selectionBackground": "#2A4060",

        "editor.inactiveSelectionBackground": "#242234",

        "editor.lineHighlightBackground": darkLine,

        "editorWhitespace.foreground": "#403E46",

        "editorIndentGuide.background1": "#2C2B31",

        "editorIndentGuide.activeBackground1": "#3B3A42",

        "editorBracketMatch.background": "#2F3A32",

        "editorBracketMatch.border": "#60D6AA",

        "editor.findMatchBackground": "#3B2F1F",

        "editor.findMatchHighlightBackground": "#2C261B",

        "editorHoverWidget.background": "#2A292E",

        "editorHoverWidget.border": "#2E2D31",

        "editorSuggestWidget.background": "#2A292E",

        "editorSuggestWidget.border": "#2E2D31",

        "editorSuggestWidget.selectedBackground": "#2F3A54",

        "scrollbarSlider.background": "#FFFFFF14",

        "scrollbarSlider.hoverBackground": "#FFFFFF22",

        "scrollbarSlider.activeBackground": "#FFFFFF2F",

        "minimap.background": "#1E1D20",

      },

    });



    monaco.editor.defineTheme("pompora-light", {

      base: "vs",

      inherit: true,

      rules: [

        { token: "comment", foreground: "6B7280", fontStyle: "italic" },

        { token: "keyword", foreground: "2563EB" },

        { token: "number", foreground: "B45309" },

        { token: "string", foreground: "16A34A" },

        { token: "type", foreground: "0E7490" },

        { token: "function", foreground: "7C3AED" },

        { token: "tag", foreground: "DC2626" },

        { token: "attribute.name", foreground: "9A3412" },

      ],

      colors: {

        "editor.background": "#FFFFFF",

        "editor.foreground": "#0F172A",

        "editorLineNumber.foreground": "#94A3B8",

        "editorLineNumber.activeForeground": "#0F172A",

        "editorCursor.foreground": lightCursor,

        "editor.selectionBackground": "#BFDBFE",

        "editor.inactiveSelectionBackground": "#E2E8F0",

        "editor.lineHighlightBackground": lightLine,

        "editorWhitespace.foreground": "#CBD5E1",

        "editorIndentGuide.background1": "#E2E8F0",

        "editorIndentGuide.activeBackground1": "#CBD5E1",

        "editorBracketMatch.background": "#DCFCE7",

        "editorBracketMatch.border": "#059669",

        "editor.findMatchBackground": "#FDE68A",

        "editor.findMatchHighlightBackground": "#FEF3C7",

        "editorHoverWidget.background": "#FFFFFF",

        "editorHoverWidget.border": "#E2E8F0",

        "editorSuggestWidget.background": "#FFFFFF",

        "editorSuggestWidget.border": "#E2E8F0",

        "editorSuggestWidget.selectedBackground": "#EFF6FF",

        "scrollbarSlider.background": "#0F172A14",

        "scrollbarSlider.hoverBackground": "#0F172A22",

        "scrollbarSlider.activeBackground": "#0F172A2F",

        "minimap.background": "#FFFFFF",

      },

    });

  }, []);



  const handleMonacoBeforeMount = useCallback(

    (monaco: typeof import("monaco-editor")) => {

      monacoRef.current = monaco;

      applyMonacoThemes(monaco, settings.editor_line_highlight_color ?? null, settings.editor_cursor_color ?? null);

    },

    [applyMonacoThemes, settings.editor_cursor_color, settings.editor_line_highlight_color]

  );



  useEffect(() => {

    const monaco = monacoRef.current;

    if (!monaco) return;

    applyMonacoThemes(monaco, settings.editor_line_highlight_color ?? null, settings.editor_cursor_color ?? null);

    try {

      monaco.editor.setTheme(settings.theme === "light" ? "pompora-light" : "pompora-dark");

    } catch {

    }

  }, [applyMonacoThemes, settings.editor_cursor_color, settings.editor_line_highlight_color, settings.theme]);



  const themeName = settings.theme === "light" ? "pompora-light" : "pompora-dark";

  const isCoding = !!activeTab && activeTab.path !== SETTINGS_TAB_PATH;



  return (

    <div className="h-full w-full bg-bg text-text">

      <div className="grid h-full grid-rows-[48px_1fr_32px]">

        <header className="bg-bg" onMouseDown={onHeaderMouseDown}>

          <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-2" data-menubar-root>

            <div className="flex min-w-0 items-center gap-2 justify-self-start">

              {isMac ? (

                <div className="mr-1 flex items-center gap-2" data-no-drag="true">

                  <button

                    type="button"

                    aria-label="Close"

                    className="h-3 w-3 rounded-full bg-red-500 hover:bg-red-400"

                    onClick={() => exitApp()}

                  />

                  <button

                    type="button"

                    aria-label="Minimize"

                    className="h-3 w-3 rounded-full bg-yellow-500 hover:bg-yellow-400"

                    onClick={() => minimizeApp()}

                  />

                  <button

                    type="button"

                    aria-label="Fullscreen"

                    className="h-3 w-3 rounded-full bg-green-500 hover:bg-green-400"

                    onClick={() => toggleFullscreenApp()}

                  />

                </div>

              ) : null}



              <img src="/logo_navbar.png" alt="Pompora" className="h-15 w-12 shrink-0" />



              <div className="ws-titlebar-pill" data-no-drag="true">

                <button

                  type="button"

                  className="ws-titlebar-icon-btn"

                  onClick={() => goBack()}

                  aria-label="Back"

                  disabled={!tabNavAvail.back}

                >

                  <ArrowLeft className="h-4 w-4" />

                </button>

                <button

                  type="button"

                  className="ws-titlebar-icon-btn"

                  onClick={() => goForward()}

                  aria-label="Forward"

                  disabled={!tabNavAvail.forward}

                >

                  <ArrowRight className="h-4 w-4" />

                </button>

              </div>

            </div>



            <div className="flex min-w-0 items-center justify-self-center">

              <div className="ws-titlebar-pill min-w-0 text-xs text-muted" data-no-drag="true">

                <div className="relative">

                  <button

                    type="button"

                    className="ws-titlebar-menu-btn"

                    onMouseEnter={() => {

                      if (!anyMenubarOpen) return;

                      setIsFileMenuOpen(true);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                    onClick={() => {

                      setIsFileMenuOpen((v) => !v);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                  >

                    File

                  </button>

                  {isFileMenuOpen ? (

                    <div className="absolute left-0 top-full z-[9999] mt-1 w-max min-w-64 max-w-[calc(100vw-16px)] overflow-x-visible overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                      <MenuItem label="New Window" shortcut="Ctrl+Shift+N" onClick={() => openNewWindow()} />

                      <MenuSep />

                      <MenuItem label="Open File" shortcut="Ctrl+O" onClick={() => void openStandaloneFile()} />

                      <MenuItem label="Open Folder" shortcut="Ctrl+K Ctrl+O" onClick={() => void openFolder()} />

                      <div className="relative">

                        <MenuItem

                          label="Open Recent"

                          right={<ChevronRight className="h-3.5 w-3.5" />}

                          keepOpen

                          onMouseEnter={(e) => {

                            clearFileRecentCloseTimer();

                            setIsFileMenuRecentOpen(true);

                            setFileRecentAnchor(e.currentTarget.getBoundingClientRect());

                          }}

                          onMouseLeave={() => scheduleFileRecentClose()}

                          onClick={() => setIsFileMenuRecentOpen((v) => !v)}

                        />

                        {isFileMenuRecentOpen && fileRecentAnchor ? (

                          <MenuPortal anchor={fileRecentAnchor} approxWidth={320}>

                            <div

                              className="w-max min-w-72 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]"

                              onMouseEnter={() => {

                                clearFileRecentCloseTimer();

                                setIsFileMenuRecentOpen(true);

                              }}

                              onMouseLeave={() => scheduleFileRecentClose()}

                            >

                              <div className="px-2 py-1 text-[11px] font-medium text-muted">Folders</div>

                              {(workspace.recent.length ? workspace.recent : settings.recent_workspaces).length ? (

                                (workspace.recent.length ? workspace.recent : settings.recent_workspaces).map((p) => (

                                  <MenuItem key={p} label={p} onClick={() => void openRecent(p)} />

                                ))

                              ) : (

                                <div className="px-2 py-1 text-xs text-muted">No recent folders</div>

                              )}



                              <MenuSep />

                              <div className="px-2 py-1 text-[11px] font-medium text-muted">Files</div>

                              {recentFiles.length ? (

                                recentFiles.map((p) => {

                                  const Icon = fileIconFor(p);

                                  return <MenuItem key={p} label={p} left={<Icon className="h-3.5 w-3.5" />} onClick={() => void openRecentFile(p)} />;

                                })

                              ) : (

                                <div className="px-2 py-1 text-xs text-muted">No recent files</div>

                              )}

                            </div>

                          </MenuPortal>

                        ) : null}

                      </div>

                      <MenuSep />

                      <MenuItem label="Add Folder to Workspace" onClick={() => void addFolderToWorkspace()} />

                      <MenuItem label="Open Saved Workspace" onClick={() => void openSavedWorkspace()} />

                      <MenuItem label="Save Workspace as" onClick={() => void saveWorkspaceAs()} />

                      <MenuItem label="Duplicate Workspace" onClick={() => void duplicateWorkspace()} />

                      <MenuSep />

                      <MenuItem label="Save" shortcut="Ctrl+S" onClick={() => void saveActiveFile()} />

                      <MenuItem label="Save As" shortcut="Ctrl+Shift+S" onClick={() => void saveAs()} />

                      <MenuItem label="Save All" shortcut="Ctrl+K S" onClick={() => void saveAll()} />

                      <MenuSep />

                      <MenuItem

                        label={autoSaveEnabled ? "Auto Save: On" : "Auto Save: Off"}

                        onClick={() => setAutoSaveEnabled((v) => !v)}

                      />

                      <MenuSep />

                      <MenuItem label="Revert File" onClick={() => void revertFile()} />

                      <MenuItem

                        label="Close Editor"

                        shortcut="Ctrl+W"

                        onClick={() => (activeTab ? closeTab(activeTab.path) : undefined)}

                      />

                      <MenuItem label="Close All Editors" shortcut="Ctrl+Shift+W" onClick={() => closeAllTabs()} />

                      <MenuItem label="Close Folder" onClick={() => void closeFolder()} />

                      <MenuItem label="Close Window" shortcut="Alt+F4" onClick={() => exitApp()} />

                      <MenuSep />

                      <MenuItem label="Exit" onClick={() => exitApp()} />

                    </div>

                  ) : null}

                </div>



                <div className="relative">

                  <button

                    type="button"

                    className="ws-titlebar-menu-btn"

                    onMouseEnter={() => {

                      if (!anyMenubarOpen) return;

                      setIsEditMenuOpen(true);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                    onClick={() => {

                      setIsEditMenuOpen((v) => !v);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                  >

                    Edit

                  </button>

                  {isEditMenuOpen ? (

                    <div className="absolute left-0 top-full z-[9999] mt-1 w-max min-w-72 max-w-[calc(100vw-16px)] overflow-x-visible overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                      <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={() => runEditCommand("undo")} />

                      <MenuItem label="Redo" shortcut="Ctrl+Y" onClick={() => runEditCommand("redo")} />

                      <MenuSep />

                      <MenuItem label="Cut" shortcut="Ctrl+X" onClick={() => runEditCommand("cut")} />

                      <MenuItem label="Copy" shortcut="Ctrl+C" onClick={() => runEditCommand("copy")} />

                      <MenuItem label="Paste" shortcut="Ctrl+V" onClick={() => runEditCommand("paste")} />

                      <MenuItem label="Select All" shortcut="Ctrl+A" onClick={() => runEditCommand("selectAll")} />

                      <MenuSep />

                      <MenuItem

                        label="Find"

                        shortcut="Ctrl+F"

                        onClick={() => {

                          const ed = editorRef.current;

                          if (ed) void ed.getAction("actions.find")?.run();

                        }}

                      />

                      <MenuItem

                        label="Replace"

                        shortcut="Ctrl+H"

                        onClick={() => {

                          const ed = editorRef.current;

                          if (ed) void ed.getAction("editor.action.startFindReplaceAction")?.run();

                        }}

                      />

                      <MenuSep />

                      <MenuItem label="Find in Files" shortcut="Ctrl+Shift+F" onClick={() => setActivity("search")} />

                      <MenuItem

                        label="Replace in Files"

                        shortcut="Ctrl+Shift+H"

                        onClick={() => void replaceInFiles()}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Toggle Line Comment"

                        shortcut="Ctrl+/"

                        onClick={() => {

                          const ok = runEditorAction("editor.action.commentLine");

                          if (!ok) notify({ kind: "info", title: "Toggle Line Comment", message: "No editor is focused." });

                        }}

                      />

                      <MenuItem

                        label="Toggle Block Comment"

                        shortcut="Shift+Alt+A"

                        onClick={() => {

                          const ok = runEditorAction("editor.action.blockComment");

                          if (!ok) notify({ kind: "info", title: "Toggle Block Comment", message: "No editor is focused." });

                        }}

                      />

                      <MenuItem

                        label="Emmet: Expand Abbreviation"

                        shortcut="Tab"

                        onClick={() => {

                          const ed = editorRef.current;

                          if (!ed) {

                            notify({ kind: "info", title: "Emmet", message: "No editor is focused." });

                            return;

                          }

                          const ok = runEditorAction("editor.emmet.action.expandAbbreviation");

                          if (!ok) notify({ kind: "info", title: "Emmet", message: "Emmet is not available in this editor." });

                        }}

                      />

                    </div>

                  ) : null}

                </div>



                <div className="relative">

                  <button

                    type="button"

                    className="ws-titlebar-menu-btn"

                    onMouseEnter={() => {

                      if (!anyMenubarOpen) return;

                      setIsSelectionMenuOpen(true);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                    onClick={() => {

                      setIsSelectionMenuOpen((v) => !v);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                  >

                    Selection

                  </button>

                  {isSelectionMenuOpen ? (

                    <div className="absolute left-0 top-full z-[9999] mt-1 w-max min-w-80 max-w-[calc(100vw-16px)] overflow-x-visible overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                      <MenuItem label="Select All" shortcut="Ctrl+A" onClick={() => notify({ kind: "info", title: "Select All", message: "Coming next." })} />

                      <MenuItem

                        label="Expand Selection"

                        shortcut="Shift+Alt+RightArrow"

                        onClick={() => notify({ kind: "info", title: "Expand Selection", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Shrink Selection"

                        onClick={() => notify({ kind: "info", title: "Shrink Selection", message: "Coming next." })}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Copy Line Up"

                        shortcut="Shift+Alt+UpArrow"

                        onClick={() => notify({ kind: "info", title: "Copy Line Up", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Copy Line Down"

                        shortcut="Shift+Alt+DownArrow"

                        onClick={() => notify({ kind: "info", title: "Copy Line Down", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Move Line Up"

                        shortcut="Alt+UpArrow"

                        onClick={() => notify({ kind: "info", title: "Move Line Up", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Move Line Down"

                        shortcut="Alt+DownArrow"

                        onClick={() => notify({ kind: "info", title: "Move Line Down", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Duplicate Selection"

                        onClick={() => notify({ kind: "info", title: "Duplicate Selection", message: "Coming next." })}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Add Cursor Above"

                        shortcut="Ctrl+Alt+UpArrow"

                        onClick={() => notify({ kind: "info", title: "Add Cursor Above", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Add Cursor Below"

                        shortcut="Ctrl+Alt+DownArrow"

                        onClick={() => notify({ kind: "info", title: "Add Cursor Below", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Add Cursors to Line End"

                        shortcut="Shift+Alt+I"

                        onClick={() => notify({ kind: "info", title: "Add Cursors to Line End", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Add Next Occurrence"

                        shortcut="Ctrl+D"

                        onClick={() => notify({ kind: "info", title: "Add Next Occurrence", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Add Previous Occurrence"

                        onClick={() => notify({ kind: "info", title: "Add Previous Occurrence", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Select All Occurrences"

                        shortcut="Ctrl+Shift+L"

                        onClick={() => notify({ kind: "info", title: "Select All Occurrences", message: "Coming next." })}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Switch to Ctrl+Click for Multi-Cursor"

                        onClick={() => notify({ kind: "info", title: "Multi-cursor", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Column Selection Mode"

                        onClick={() => notify({ kind: "info", title: "Column Selection Mode", message: "Coming next." })}

                      />

                    </div>

                  ) : null}

                </div>



                <div className="relative">

                  <button

                    type="button"

                    className="ws-titlebar-menu-btn"

                    onMouseEnter={() => {

                      if (!anyMenubarOpen) return;

                      setIsViewMenuOpen(true);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                    }}

                    onClick={() => {

                      setIsViewMenuOpen((v) => !v);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                    }}

                  >

                    View

                  </button>

                  {isViewMenuOpen ? (

                    <div

                      className="absolute left-0 top-full z-[9999] mt-1 w-max min-w-80 max-w-[calc(100vw-16px)] overflow-x-visible overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]"

                    >

                      <MenuItem label="Command Palette…" shortcut="Ctrl+Shift+P" onClick={() => setIsPaletteOpen(true)} />

                      <MenuItem label="Open View…" onClick={() => notify({ kind: "info", title: "Open View", message: "Coming next." })} />

                      <MenuSep />



                      <div className="relative">

                        <MenuItem

                          label="Appearance"

                          right={<ChevronRight className="h-3.5 w-3.5" />}

                          keepOpen

                          onMouseEnter={(e) => {

                            setViewMenuSub("appearance");

                            setViewAppearanceAnchor(e.currentTarget.getBoundingClientRect());

                          }}

                          onClick={() => setViewMenuSub((v) => (v === "appearance" ? null : "appearance"))}

                        />

                        {viewMenuSub === "appearance" && viewAppearanceAnchor ? (

                          <MenuPortal anchor={viewAppearanceAnchor} approxWidth={360}>

                            <div

                              className="w-max min-w-80 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]"

                              onMouseEnter={() => setViewMenuSub("appearance")}

                              onMouseLeave={() => {

                                setViewMenuSub(null);

                                setViewAppearanceSub(null);

                                setViewAppearanceSubAnchor(null);

                              }}

                            >

                            <MenuItem label="Full Screen" shortcut="F11" onClick={() => notify({ kind: "info", title: "Full Screen", message: "Coming next." })} />

                            <MenuItem

                              label="Zen Mode"

                              shortcut="Ctrl+K Z"

                              onClick={() => notify({ kind: "info", title: "Zen Mode", message: "Coming next." })}

                            />

                            <MenuItem

                              label="Centered Layout"

                              onClick={() => notify({ kind: "info", title: "Centered Layout", message: "Coming next." })}

                            />

                            <MenuSep />

                            <MenuItem label="Menu Bar" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Menu Bar", message: "Coming next." })} />

                            <MenuItem label="Primary Side Bar" shortcut="Ctrl+B" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Primary Side Bar", message: "Coming next." })} />

                            <MenuItem label="Secondary Side Bar" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Secondary Side Bar", message: "Coming next." })} />

                            <MenuItem label="Status Bar" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Status Bar", message: "Coming next." })} />

                            <MenuItem label="Panel" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Panel", message: "Coming next." })} />

                            <MenuSep />

                            <MenuItem

                              label="Move Primary Side Bar Right"

                              onClick={() => notify({ kind: "info", title: "Move Primary Side Bar Right", message: "Coming next." })}

                            />



                            <div className="relative">

                              <MenuItem

                                label="Activity Bar Position"

                                right={<ChevronRight className="h-3.5 w-3.5" />}

                                keepOpen

                                onMouseEnter={(e) => {

                                  setViewAppearanceSub("activityBarPosition");

                                  setViewAppearanceSubAnchor(e.currentTarget.getBoundingClientRect());

                                }}

                                onClick={() => setViewAppearanceSub((v) => (v === "activityBarPosition" ? null : "activityBarPosition"))}

                              />

                              {viewAppearanceSub === "activityBarPosition" && viewAppearanceSubAnchor ? (

                                <MenuPortal anchor={viewAppearanceSubAnchor} approxWidth={240} preferLeft>

                                  <div className="w-max min-w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                                  <MenuItem label="Default" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />

                                  <MenuItem label="Top" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />

                                  <MenuItem label="Bottom" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />

                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />

                                  </div>

                                </MenuPortal>

                              ) : null}

                            </div>



                            <div className="relative">

                              <MenuItem

                                label="Secondary Activity Bar Position"

                                right={<ChevronRight className="h-3.5 w-3.5" />}

                                keepOpen

                                onMouseEnter={(e) => {

                                  setViewAppearanceSub("secondaryActivityBarPosition");

                                  setViewAppearanceSubAnchor(e.currentTarget.getBoundingClientRect());

                                }}

                                onClick={() => setViewAppearanceSub((v) => (v === "secondaryActivityBarPosition" ? null : "secondaryActivityBarPosition"))}

                              />

                              {viewAppearanceSub === "secondaryActivityBarPosition" && viewAppearanceSubAnchor ? (

                                <MenuPortal anchor={viewAppearanceSubAnchor} approxWidth={240} preferLeft>

                                  <div className="w-max min-w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                                  <MenuItem label="Default" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />

                                  <MenuItem label="Top" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />

                                  <MenuItem label="Bottom" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />

                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />

                                  </div>

                                </MenuPortal>

                              ) : null}

                            </div>



                            <div className="relative">

                              <MenuItem

                                label="Panel Position"

                                right={<ChevronRight className="h-3.5 w-3.5" />}

                                keepOpen

                                onMouseEnter={(e) => {

                                  setViewAppearanceSub("panelPosition");

                                  setViewAppearanceSubAnchor(e.currentTarget.getBoundingClientRect());

                                }}

                                onClick={() => setViewAppearanceSub((v) => (v === "panelPosition" ? null : "panelPosition"))}

                              />

                              {viewAppearanceSub === "panelPosition" && viewAppearanceSubAnchor ? (

                                <MenuPortal anchor={viewAppearanceSubAnchor} approxWidth={240} preferLeft>

                                  <div className="w-max min-w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                                  <MenuItem label="Top" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />

                                  <MenuItem label="Left" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />

                                  <MenuItem label="Right" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />

                                  <MenuItem label="Bottom" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />

                                  </div>

                                </MenuPortal>

                              ) : null}

                            </div>



                            <div className="relative">

                              <MenuItem

                                label="Align Panel"

                                right={<ChevronRight className="h-3.5 w-3.5" />}

                                keepOpen

                                onMouseEnter={(e) => {

                                  setViewAppearanceSub("alignPanel");

                                  setViewAppearanceSubAnchor(e.currentTarget.getBoundingClientRect());

                                }}

                                onClick={() => setViewAppearanceSub((v) => (v === "alignPanel" ? null : "alignPanel"))}

                              />

                              {viewAppearanceSub === "alignPanel" && viewAppearanceSubAnchor ? (

                                <MenuPortal anchor={viewAppearanceSubAnchor} approxWidth={240} preferLeft>

                                  <div className="w-max min-w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                                  <MenuItem label="Center" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />

                                  <MenuItem label="Justify" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />

                                  <MenuItem label="Left" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />

                                  <MenuItem label="Right" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />

                                  </div>

                                </MenuPortal>

                              ) : null}

                            </div>



                            <div className="relative">

                              <MenuItem

                                label="Tab Bar"

                                right={<ChevronRight className="h-3.5 w-3.5" />}

                                keepOpen

                                onMouseEnter={(e) => {

                                  setViewAppearanceSub("tabBar");

                                  setViewAppearanceSubAnchor(e.currentTarget.getBoundingClientRect());

                                }}

                                onClick={() => setViewAppearanceSub((v) => (v === "tabBar" ? null : "tabBar"))}

                              />

                              {viewAppearanceSub === "tabBar" && viewAppearanceSubAnchor ? (

                                <MenuPortal anchor={viewAppearanceSubAnchor} approxWidth={240} preferLeft>

                                  <div className="w-max min-w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                                  <MenuItem label="Multiple Tabs" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Tab Bar", message: "Coming next." })} />

                                  <MenuItem label="Single Tabs" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Tab Bar", message: "Coming next." })} />

                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Tab Bar", message: "Coming next." })} />

                                  </div>

                                </MenuPortal>

                              ) : null}

                            </div>



                            <div className="relative">

                              <MenuItem

                                label="Editor Actions Position"

                                right={<ChevronRight className="h-3.5 w-3.5" />}

                                keepOpen

                                onMouseEnter={(e) => {

                                  setViewAppearanceSub("editorActionsPosition");

                                  setViewAppearanceSubAnchor(e.currentTarget.getBoundingClientRect());

                                }}

                                onClick={() => setViewAppearanceSub((v) => (v === "editorActionsPosition" ? null : "editorActionsPosition"))}

                              />

                              {viewAppearanceSub === "editorActionsPosition" && viewAppearanceSubAnchor ? (

                                <MenuPortal anchor={viewAppearanceSubAnchor} approxWidth={240} preferLeft>

                                  <div className="w-max min-w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                                  <MenuItem label="Tab Bar" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Editor Actions", message: "Coming next." })} />

                                  <MenuItem label="Title Bar" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Editor Actions", message: "Coming next." })} />

                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Editor Actions", message: "Coming next." })} />

                                  </div>

                                </MenuPortal>

                              ) : null}

                            </div>



                            <MenuSep />

                            <MenuItem label="Minimap" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Minimap", message: "Coming next." })} />

                            <MenuItem label="Breadcrumbs" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Breadcrumbs", message: "Coming next." })} />

                            <MenuItem label="Sticky Scroll" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Sticky Scroll", message: "Coming next." })} />

                            <MenuItem label="Render Whitespace" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Render Whitespace", message: "Coming next." })} />

                            <MenuItem

                              label="Render Control Characters"

                              right={<MenuCheck checked />}

                              onClick={() => notify({ kind: "info", title: "Render Control Characters", message: "Coming next." })}

                            />

                            </div>

                          </MenuPortal>

                        ) : null}

                      </div>



                      <MenuSep />

                      <MenuItem label="Zoom In" shortcut="Ctrl+=" onClick={() => notify({ kind: "info", title: "Zoom In", message: "Coming next." })} />

                      <MenuItem label="Zoom Out" shortcut="Ctrl+-" onClick={() => notify({ kind: "info", title: "Zoom Out", message: "Coming next." })} />

                      <MenuItem

                        label="Reset Zoom"

                        shortcut="Ctrl+NumPad0"

                        onClick={() => notify({ kind: "info", title: "Reset Zoom", message: "Coming next." })}

                      />

                      <MenuSep />



                      <div className="relative">

                        <MenuItem

                          label="Editor Layout"

                          right={<ChevronRight className="h-3.5 w-3.5" />}

                          keepOpen

                          onMouseEnter={(e) => {

                            setViewMenuSub("editorLayout");

                            setViewEditorLayoutAnchor(e.currentTarget.getBoundingClientRect());

                          }}

                          onClick={() => setViewMenuSub((v) => (v === "editorLayout" ? null : "editorLayout"))}

                        />

                        {viewMenuSub === "editorLayout" && viewEditorLayoutAnchor ? (

                          <MenuPortal anchor={viewEditorLayoutAnchor} approxWidth={320}>

                            <div

                              className="w-max min-w-64 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]"

                              onMouseEnter={() => setViewMenuSub("editorLayout")}

                              onMouseLeave={() => setViewMenuSub(null)}

                            >

                            <MenuItem

                              label="Split Up"

                              shortcut="Ctrl+K Ctrl+\\"

                              onClick={() => notify({ kind: "info", title: "Split Up", message: "Coming next." })}

                            />

                            <MenuItem label="Split Down" onClick={() => notify({ kind: "info", title: "Split Down", message: "Coming next." })} />

                            <MenuItem label="Split Left" onClick={() => notify({ kind: "info", title: "Split Left", message: "Coming next." })} />

                            <MenuItem label="Split Right" onClick={() => notify({ kind: "info", title: "Split Right", message: "Coming next." })} />

                            <MenuSep />

                            <MenuItem

                              label="Split in Group"

                              shortcut="Ctrl+Shift+\\"

                              onClick={() => notify({ kind: "info", title: "Split in Group", message: "Coming next." })}

                            />

                            <MenuSep />

                            <MenuItem label="Single" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuItem label="Two Columns" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuItem label="Three Columns" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuItem label="Two Rows" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuItem label="Three Rows" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuItem label="Grid 2x2" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuItem label="Two Rows Right" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuItem label="Two Columns Bottom" onClick={() => notify({ kind: "info", title: "Layout", message: "Coming next." })} />

                            <MenuSep />

                            <MenuItem

                              label="Flip Layout"

                              shortcut="Shift+Alt+0"

                              onClick={() => notify({ kind: "info", title: "Flip Layout", message: "Coming next." })}

                            />

                            </div>

                          </MenuPortal>

                        ) : null}

                      </div>



                      <MenuSep />

                      <MenuItem label="Explorer" shortcut="Ctrl+Shift+E" onClick={() => setActivity("explorer")} />

                      <MenuItem label="Search" shortcut="Ctrl+Shift+F" onClick={() => setActivity("search")} />

                      <MenuItem label="Source Control" shortcut="Ctrl+Shift+G" onClick={() => setActivity("scm")} />

                      <MenuItem

                        label="Run"

                        shortcut="Ctrl+Shift+D"

                        onClick={() => notify({ kind: "info", title: "Run", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Extensions"

                        shortcut="Ctrl+Shift+X"

                        onClick={() => notify({ kind: "info", title: "Extensions", message: "Coming next." })}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Problems"

                        shortcut="Ctrl+Shift+M"

                        onClick={() => notify({ kind: "info", title: "Problems", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Output"

                        shortcut="Ctrl+Shift+U"

                        onClick={() => notify({ kind: "info", title: "Output", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Debug Console"

                        shortcut="Ctrl+Shift+Y"

                        onClick={() => notify({ kind: "info", title: "Debug Console", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Terminal"

                        shortcut="Ctrl+`"

                        onClick={() => {

                          toggleTerminal();

                        }}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Word Wrap"

                        shortcut="Alt+Z"

                        onClick={() => notify({ kind: "info", title: "Word Wrap", message: "Coming next." })}

                      />

                    </div>

                  ) : null}

                </div>



                <div className="relative">

                  <button

                    type="button"

                    className="ws-titlebar-menu-btn"

                    onMouseEnter={() => {

                      if (!anyMenubarOpen) return;

                      setIsRunMenuOpen(true);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                    onClick={() => {

                      setIsRunMenuOpen((v) => !v);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsTerminalMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                  >

                    Run

                  </button>

                  {isRunMenuOpen ? (

                    <div className="absolute left-0 top-full z-[9999] mt-1 w-72 overflow-hidden rounded-xl border border-[#1A191C] bg-panel p-1 shadow">

                      <MenuItem label="Start Debugging" shortcut="F5" onClick={() => notify({ kind: "info", title: "Start Debugging", message: "Coming next." })} />

                      <MenuItem

                        label="Run Without Debugging"

                        shortcut="Ctrl+F5"

                        onClick={() => notify({ kind: "info", title: "Run Without Debugging", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Stop Debugging"

                        shortcut="Shift+F5"

                        onClick={() => notify({ kind: "info", title: "Stop Debugging", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Restart Debugging"

                        shortcut="Ctrl+Shift+F5"

                        onClick={() => notify({ kind: "info", title: "Restart Debugging", message: "Coming next." })}

                      />

                    </div>

                  ) : null}

                </div>



                <div className="relative">

                  <button

                    type="button"

                    className="ws-titlebar-menu-btn"

                    onMouseEnter={() => {

                      if (!anyMenubarOpen) return;

                      setIsTerminalMenuOpen(true);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                    onClick={() => {

                      setIsTerminalMenuOpen((v) => !v);

                      setIsFileMenuOpen(false);

                      setIsFileMenuRecentOpen(false);

                      setIsEditMenuOpen(false);

                      setIsSelectionMenuOpen(false);

                      setIsViewMenuOpen(false);

                      setIsRunMenuOpen(false);

                      setViewMenuSub(null);

                      setViewAppearanceSub(null);

                    }}

                  >

                    Terminal

                  </button>

                  {isTerminalMenuOpen ? (

                    <div className="absolute left-0 top-full z-[9999] mt-1 w-80 overflow-hidden rounded-xl border border-[#1A191C] bg-panel p-1 shadow">

                      <MenuItem

                        label="New Terminal"

                        shortcut="Ctrl+Shift+`"

                        onClick={() => {

                          void closeTerminal().finally(() => {

                            toggleTerminal();

                          });

                        }}

                      />

                      <MenuItem

                        label="Split Terminal"

                        shortcut="Ctrl+Shift+5"

                        onClick={() => notify({ kind: "info", title: "Split Terminal", message: "Coming next." })}

                      />

                      <MenuItem

                        label="New Terminal Window"

                        shortcut="Ctrl+Shift+Alt+`"

                        onClick={() => notify({ kind: "info", title: "New Terminal Window", message: "Coming next." })}

                      />

                      <MenuSep />

                      <MenuItem label="Run Task…" onClick={() => notify({ kind: "info", title: "Run Task", message: "Coming next." })} />

                      <MenuItem

                        label="Run Build Task…"

                        shortcut="Ctrl+Shift+B"

                        onClick={() => notify({ kind: "info", title: "Run Build Task", message: "Coming next." })}

                      />

                      <MenuItem label="Run Active File" onClick={() => notify({ kind: "info", title: "Run Active File", message: "Coming next." })} />

                      <MenuItem

                        label="Run Selected Text"

                        onClick={() => notify({ kind: "info", title: "Run Selected Text", message: "Coming next." })}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Show Running Tasks…"

                        onClick={() => notify({ kind: "info", title: "Show Running Tasks", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Restart Running Tasks…"

                        onClick={() => notify({ kind: "info", title: "Restart Running Tasks", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Terminate Task…"

                        onClick={() => notify({ kind: "info", title: "Terminate Task", message: "Coming next." })}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Configure Tasks…"

                        onClick={() => notify({ kind: "info", title: "Configure Tasks", message: "Coming next." })}

                      />

                      <MenuItem

                        label="Configure Default Build Task…"

                        onClick={() => notify({ kind: "info", title: "Configure Default Build Task", message: "Coming next." })}

                      />

                    </div>

                  ) : null}

                </div>



                <button

                  type="button"

                  className="ws-titlebar-menu-btn inline-flex items-center gap-2"

                  onClick={() => setIsPaletteOpen(true)}

                >

                  <Search className="h-4 w-4" />

                  Quick Actions

                </button>

              </div>

            </div>



            <div className="flex shrink-0 items-center gap-1 justify-self-end">

              {authProfile ? (

                <div className="relative" data-account-menu-root>

                  <button

                    type="button"

                    className="ws-icon-btn h-8 w-8 p-0"

                    onClick={() => {

                      setIsAccountMenuOpen((v) => !v);

                    }}

                    disabled={isAuthBusy}

                    aria-label="Account"

                  >

                    <div className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[rgb(var(--p-panel2))]">

                      <div className="text-[11px] font-semibold leading-none text-text">{avatarLetter}</div>

                      {(avatarDataUrl || authProfile.avatar_url) && !avatarImgError ? (

                        <img

                          src={avatarDataUrl || authProfile.avatar_url}

                          className="absolute inset-0 block h-full w-full object-cover"

                          alt="Profile"

                          onError={() => {

                            devConsoleError("avatar image failed to load", { url: avatarDataUrl || authProfile.avatar_url });

                            setAvatarImgError(true);

                          }}

                        />

                      ) : null}

                    </div>

                  </button>



                  {isAccountMenuOpen ? (

                    <div className="absolute right-0 top-full z-[9999] mt-1 w-72 max-w-[calc(100vw-16px)] overflow-x-visible overflow-y-auto rounded-xl border border-[#1A191C] bg-panel p-1 shadow max-h-[calc(100vh-80px)]">

                      <div className="px-3 py-2">

                        <div className="text-xs font-semibold text-text">{authProfile.email || "Account"}</div>

                        <div className="mt-0.5 text-[11px] text-muted">Plan: {authCredits?.plan || authProfile.plan || "starter"}</div>

                        {authCredits ? (

                          <div className="mt-2 text-[11px] text-muted">

                            Slow credits: {authCredits.slow.remaining} / {authCredits.slow.limit}

                          </div>

                        ) : null}

                      </div>

                      <MenuSep />

                      <MenuItem

                        label="Open Dashboard"

                        onClick={() => {

                          setIsAccountMenuOpen(false);

                          void safeOpenUrl("https://pompora.dev/dashboard");

                        }}

                      />

                      <MenuItem

                        label="Manage Plan"

                        onClick={() => {

                          setIsAccountMenuOpen(false);

                          void safeOpenUrl("https://pompora.dev/pricing");

                        }}

                      />

                      <MenuSep />

                      <MenuItem

                        label="Sign out"

                        onClick={() => {

                          setIsAccountMenuOpen(false);

                          void logoutDesktop();

                        }}

                      />

                    </div>

                  ) : null}

                </div>

              ) : (

                <button

                  type="button"

                  className="ws-vscode-btn ws-vscode-btn-primary h-7 px-6 text-[13px] font-medium text-white"

                  disabled={isAuthBusy}

                  onClick={() => {

                    setIsAccountMenuOpen(false);

                    void beginDesktopAuthWithMode("login");

                  }}

                >

                  Log in

                </button>

              )}



              <button type="button" className="ws-titlebar-icon-btn" onClick={() => openSettingsTab()}>

                <SettingsIcon className="h-4 w-4" />

              </button>



              {!isMac ? (

                <div className="ws-titlebar-pill ml-1" data-no-drag="true">

                  <button

                    type="button"

                    className="ws-titlebar-window-btn"

                    aria-label="Minimize"

                    onClick={() => minimizeApp()}

                  >

                    <Minus className="h-4 w-4" />

                  </button>

                  <button

                    type="button"

                    className="ws-titlebar-window-btn"

                    aria-label="Maximize"

                    onClick={() => toggleMaximizeApp()}

                  >

                    <Maximize2 className="h-4 w-4" />

                  </button>

                  <button

                    type="button"

                    className="ws-titlebar-window-btn hover:bg-red-500/15 hover:text-red-300"

                    aria-label="Close"

                    onClick={() => exitApp()}

                  >

                    <X className="h-4 w-4" />

                  </button>

                </div>

              ) : null}

            </div>

          </div>

        </header>



        <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden bg-bg p-1.5" style={{ gridTemplateColumns: mainGridTemplateColumns }}>

          <aside className="min-w-0 overflow-hidden rounded-2xl bg-panel">

            <div className="flex h-full flex-col items-center gap-2 py-2">

              <ActivityButton id="explorer" active={activity === "explorer"} onClick={setActivity} Icon={FolderOpen} />

              <ActivityButton id="search" active={activity === "search"} onClick={setActivity} Icon={Search} />

              <ActivityButton id="scm" active={activity === "scm"} onClick={setActivity} Icon={GitBranch} />

              <div className="flex-1" />

            </div>

          </aside>



          <aside className="relative min-h-0 min-w-0 overflow-hidden rounded-2xl bg-panel">

            <div

              className="absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize"

              onMouseDown={(e) => {

                explorerResizeStateRef.current = { startX: e.clientX, startW: explorerWidth };

              }}

            />



            {activity === "explorer" ? (

              <Explorer

                workspaceRoot={workspace.root}

                recent={workspace.recent}

                explorer={explorer}

                expandedDirs={expandedDirs}

                selectedPath={selectedPath}

                inlineRenamePath={inlineRenamePath}

                inlineRenameValue={inlineRenameValue}

                onInlineRenameValue={setInlineRenameValue}

                onInlineRenameCommit={() => void commitInlineRename({ openAfter: true })}

                onInlineRenameCancel={() => void cancelInlineRename()}

                onContextMenu={(info) => setExplorerMenu(info)}

                showTooltipForEl={showTooltipForEl}

                hideTooltip={hideTooltip}

                onOpenFolder={() => void openFolder()}

                onOpenStandaloneFile={() => void openStandaloneFile()}

                onOpenRecent={(p) => void openRecent(p)}

                onToggleDir={async (dir) => {

                  const next = new Set(expandedDirs);

                  if (next.has(dir)) {

                    next.delete(dir);

                    setExpandedDirs(next);

                    return;

                  }



                  next.add(dir);

                  setExpandedDirs(next);



                  if (!explorer[dir]) {

                    await refreshDir(dir);

                  }

                }}

                onSelect={(p) => setSelectedPath(p)}

                onOpenFile={(p) => void openFile(p)}

                onRefresh={() => void refreshRoot()}

                onCreateNewFolder={() => void createNewFolder()}

              />

            ) : activity === "search" ? (

              <Panel title="Search">

                {!workspace.root ? (

                  <div className="text-sm text-muted">Open a folder to search.</div>

                ) : (

                  <div className="space-y-3">

                    <input

                      className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted"

                      placeholder="Find in files"

                      value={searchQuery}

                      onChange={(e) => setSearchQuery(e.currentTarget.value)}

                      autoFocus

                    />



                    <div className="text-xs text-muted">

                      {isSearching ? "Searching..." : `${searchResults.length} results`}

                    </div>



                    <div className="space-y-1">

                      {searchResults.map((m, idx) => (

                        <button

                          key={`${m.path}:${m.line}:${idx}`}

                          type="button"

                          className="w-full rounded border border-border bg-bg px-3 py-2 text-left text-sm text-muted hover:border-accent hover:text-text"

                          onClick={async () => {

                            setPendingReveal({ path: m.path, line: m.line, text: m.text });

                            await openFile(m.path);

                          }}

                        >

                          <div className="flex items-center justify-between gap-2">

                            <span className="flex min-w-0 items-center gap-2 truncate text-text">

                              {(() => {

                                const Icon = fileIconFor(m.path);

                                return <Icon className="h-4 w-4 shrink-0" />;

                              })()}

                              <span className="min-w-0 flex-1 truncate">{m.path}</span>

                            </span>

                            <span className="shrink-0 text-xs text-muted">{m.line}</span>

                          </div>

                          <div className="mt-1 truncate text-xs text-muted">{m.text}</div>

                        </button>

                      ))}

                    </div>

                  </div>

                )}

              </Panel>

            ) : activity === "scm" ? (

              <Panel title="Source Control">

                <div className="text-sm text-muted">Git view is coming next.</div>

              </Panel>

            ) : null}

          </aside>



          <main className={`min-h-0 min-w-0 overflow-hidden rounded-2xl ${isCoding ? "ws-editor-surface" : "bg-panel"}`}>

            <div className="flex h-full min-h-0 flex-col">

              <div className={`flex h-14 items-center gap-1 px-2 ${isCoding ? "ws-editor-surface" : "bg-panel"}`}>

                <div className="relative min-w-0 flex-1">

                  <div

                    ref={tabsScrollRef}

                    className="ws-tabs-scroll flex min-w-0 items-center gap-1 overflow-auto"

                    onScroll={() => updateTabsIndicator()}

                    onWheel={(e) => {

                      const el = tabsScrollRef.current;

                      if (!el) return;

                      const canScroll = el.scrollWidth > el.clientWidth;

                      if (!canScroll) return;



                      const dy = e.deltaY;

                      const dx = e.deltaX;

                      const next = el.scrollLeft + (Math.abs(dx) > Math.abs(dy) ? dx : dy);

                      if (next !== el.scrollLeft) {

                        e.preventDefault();

                        el.scrollLeft = next;

                        updateTabsIndicator();

                      }

                    }}

                  >

                    {tabs.map((t) => (

                      <TabButton

                        key={t.path}

                        tab={t}

                        active={t.path === activeTabPath}

                        onActivate={() => setActiveTabPath(t.path)}

                        onClose={() => closeTab(t.path)}

                      />

                    ))}

                  </div>



                  <div className={`ws-tabs-indicator ${tabsIndicator.visible ? "ws-tabs-indicator-on" : ""}`} aria-hidden>

                    <div

                      className="ws-tabs-indicator-thumb"

                      style={{ width: `${tabsIndicator.widthPx}px`, transform: `translateX(${tabsIndicator.leftPx}px)` }}

                    />

                  </div>

                </div>

                <button type="button" className="ws-icon-btn" onClick={() => void openFolder()}>

                  <Plus className="h-4 w-4" />

                </button>

              </div>



              <div className="min-h-0 flex-1 flex flex-col">

                {activeTab?.path === SETTINGS_TAB_PATH ? (

                  <div className="min-h-0 flex-1 overflow-auto">

                    <SettingsErrorBoundary>

                      <SettingsScreen

                        settings={settings}

                        authProfile={authProfile}

                        authCredits={authCredits}

                        isAuthBusy={isAuthBusy}

                        providerLabel={providerLabel}

                        keyStatus={keyStatus}

                        providerChoices={settingsProviderChoices}

                        apiKeyDraft={apiKeyDraft}

                        encryptionPasswordDraft={encryptionPasswordDraft}

                        secretsError={secretsError}

                        isSavingSettings={isSavingSettings}

                        isTogglingOffline={isTogglingOffline}

                        isKeyOperationInProgress={isKeyOperationInProgress}

                        isSettingsLoaded={isSettingsLoaded}

                        workspaceLabel={workspaceLabel}

                        recentWorkspaces={workspace.recent}

                        onChangeTheme={(t: Theme) => setSettingsState((s) => ({ ...s, theme: t }))}

                        onChangeCursorBlinking={(v) => void setCursorBlinking(v)}

                        onChangeLineHighlightColor={(hex) => void setLineHighlightColor(hex)}

                        onChangeCursorColor={(hex) => void setCursorColor(hex)}

                        onChangeKeybindings={(next) => void setKeybindings(next)}

                        onToggleOffline={toggleOfflineMode}

                        onChangeProvider={(p) => void changeProvider(p)}

                        onChangePomporaThinking={(t) => void setPomporaThinking(t)}

                        onPickFolder={() => void openFolder()}

                        onOpenRecent={(p) => void openRecent(p)}

                        onApiKeyDraft={setApiKeyDraft}

                        onEncryptionPasswordDraft={setEncryptionPasswordDraft}

                        onStoreKey={handleStoreKey}

                        onClearKey={clearProviderKey}

                        onLoginToPompora={() => void beginDesktopAuthWithMode("login")}

                        onSignupToPompora={() => void beginDesktopAuthWithMode("signup")}

                        onSaveSettings={saveSettingsNow}

                        showKeySaved={showKeySaved}

                        showKeyCleared={showKeyCleared}

                        onDebugGemini={handleDebugGemini}

                        debugResult={debugResult}

                        providerModels={providerModels}

                        loadingModels={loadingModels}

                        providerModelsError={providerModelsError}

                        onLoadModels={(providerId) => void loadProviderModels(providerId)}

                        onSelectModel={async (providerId, modelId) => {

                          const next = { ...settings, active_provider: providerId, active_model: modelId };

                          setSettingsState(next);

                          try {

                            await settingsSet(next);

                            notify({ kind: "info", title: "Model Selected", message: `Selected ${modelId}` });

                          } catch (e) {

                            devConsoleError("Failed to save model selection", e);

                            setSettingsState(settings);

                          }

                        }}

                        onClearChatHistory={() => void clearChatHistoryNow()}

                        onClearAllProviderKeys={() => void clearAllProviderKeysNow()}

                        onClearAuth={() => void clearAuthNow()}

                        onClearSettingsFile={() => void clearSettingsFileNow()}

                        onWipeAll={() => void wipeAllNow()}

                      />

                    </SettingsErrorBoundary>

                  </div>

                ) : !workspace.root ? (

                  <WelcomeScreen

                    recentWorkspaces={workspace.recent}

                    recentFiles={recentFiles}

                    onOpenFolder={() => void openFolder()}

                    onOpenFile={() => void openStandaloneFile()}

                    onOpenRecentWorkspace={(p) => void openRecent(p)}

                    onOpenRecentFile={(p) => void openRecentFile(p)}

                    onOpenChat={() => setIsChatDockOpen(true)}

                    onOpenCommandPalette={() => setIsPaletteOpen(true)}

                    shortcutOpenFolder={__normShortcut(kbRaw("file.openFolder")) || "Ctrl+K Ctrl+O"}

                    shortcutOpenFile={__normShortcut(kbRaw("file.openFile")) || "Ctrl+O"}

                    shortcutOpenChat={__normShortcut(kbRaw("chat.toggle")) || "Ctrl+L"}

                    shortcutOpenCommandPalette={__normShortcut(kbRaw("view.commandPalette")) || "Ctrl+Shift+P"}

                  />

                ) : !activeTab ? (

                  <WelcomeScreen

                    recentWorkspaces={workspace.recent}

                    recentFiles={recentFiles}

                    onOpenFolder={() => void openFolder()}

                    onOpenFile={() => void openStandaloneFile()}

                    onOpenRecentWorkspace={(p) => void openRecent(p)}

                    onOpenRecentFile={(p) => void openRecentFile(p)}

                    onOpenChat={() => setIsChatDockOpen(true)}

                    onOpenCommandPalette={() => setIsPaletteOpen(true)}

                    shortcutOpenFolder={__normShortcut(kbRaw("file.openFolder")) || "Ctrl+K Ctrl+O"}

                    shortcutOpenFile={__normShortcut(kbRaw("file.openFile")) || "Ctrl+O"}

                    shortcutOpenChat={__normShortcut(kbRaw("chat.toggle")) || "Ctrl+L"}

                    shortcutOpenCommandPalette={__normShortcut(kbRaw("view.commandPalette")) || "Ctrl+Shift+P"}

                    title="POMPORA"

                    subtitle="Getting started with Pompora"

                    hint="Open a file from Explorer to start editing."

                  />

                ) : activeTab.kind === "image" ? (

                  <div className="relative min-h-0 flex-1 ws-editor-surface">

                    <ImageTabView

                      tab={activeTab}

                      containerRef={imageContainerRef}

                      transform={`translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageScale})`}

                      zoomLabel={`${Math.round(imageScale * 100)}%`}

                      scale={imageScale}

                      offset={imageOffset}

                      naturalSize={imageNaturalSize}

                      onSetScale={(next) => {

                        const el = imageContainerRef.current;

                        if (!el) {

                          setImageScale(next);

                          return;

                        }

                        const rect = el.getBoundingClientRect();

                        const cx = rect.width / 2;

                        const cy = rect.height / 2;

                        setScaleAroundPoint(next, cx, cy);

                      }}

                      onFit={() => fitImageToView()}

                      onZoomIn={() => zoomImage(1.2)}

                      onZoomOut={() => zoomImage(1 / 1.2)}

                      onReset={() => resetImageView()}

                      onRefresh={() => void refreshImageTab(activeTab.path)}

                      onOpenAsText={() => void openFileText(activeTab.path)}

                      onWheel={onImageWheel}

                      onPointerDown={onImagePointerDown}

                      onPointerMove={onImagePointerMove}

                      onPointerUp={onImagePointerUp}

                      onPointerCancel={onImagePointerUp}

                    />

                  </div>

                ) : (

                  <>

                    <div className="min-h-0 flex-1 flex flex-col">

                      <div className="relative min-h-0 flex-1 ws-editor-surface">

                        {activeTabChangeFile ? (

                        <DiffEditor

                          height="100%"

                          theme={themeName}

                          language={activeTab.language}

                          beforeMount={handleMonacoBeforeMount}

                          original={activeTabChangeFile.before ?? ""}

                          modified={typedEditorText !== null ? typedEditorText : (activeTabChangeFile.after ?? activeTab.content)}

                          onMount={(ed) => {

                            const mod = ed.getModifiedEditor();

                            editorRef.current = mod;

                            bindMonacoShortcuts(mod);

                            cursorListenerDisposeRef.current?.dispose();

                            cursorListenerDisposeRef.current = mod.onDidChangeCursorPosition((ev) => {

                              const p = ev.position;

                              setCursorPos({ line: p.lineNumber, col: p.column });

                            });

                            const p = mod.getPosition();

                            if (p) setCursorPos({ line: p.lineNumber, col: p.column });



                            editorKeydownDisposeRef.current?.dispose();

                            editorKeydownDisposeRef.current = mod.onKeyDown((ev) => {

                              const be = (ev as any)?.browserEvent as KeyboardEvent | undefined;

                              if (!be) return;

                              try {

                                if (localStorage.getItem("pompora.debug.shortcuts") === "1") {

                                  // eslint-disable-next-line no-console

                                  console.log("[monaco]", { key: be.key, code: (be as any).code, ctrl: be.ctrlKey, shift: be.shiftKey, alt: be.altKey, meta: be.metaKey });

                                }

                              } catch {

                              }



                              const evRaw = __eventToShortcut(be);

                              const evNorm = evRaw ? __normShortcut(evRaw) : "";

                              const chatToggleNorm = chatToggleNormRef.current;

                              if (localStorage.getItem("pompora.debug.shortcuts") === "1") {

                                // eslint-disable-next-line no-console

                                console.log("[monaco.chat]", { evNorm, chatToggleNorm });

                              }

                              if (evNorm && chatToggleNorm && evNorm === chatToggleNorm) {

                                setIsChatDockOpen((v) => !v);

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }



                              const k = String(be.key || "").toLowerCase();

                              if (be.altKey && !be.ctrlKey && !be.metaKey && (be.key === "ArrowLeft" || be.key === "Left")) {

                                goBack();

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.altKey && !be.ctrlKey && !be.metaKey && (be.key === "ArrowRight" || be.key === "Right")) {

                                goForward();

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.ctrlKey && !be.altKey && !be.metaKey && !be.shiftKey && k === "z") {

                                try {

                                  mod.trigger("keyboard", "undo", null);

                                } catch {

                                  if (!runEditorAction("undo")) runEditorAction("editor.action.undo");

                                }

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.ctrlKey && !be.altKey && !be.metaKey && be.shiftKey && k === "z") {

                                try {

                                  mod.trigger("keyboard", "redo", null);

                                } catch {

                                  if (!runEditorAction("redo")) runEditorAction("editor.action.redo");

                                }

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.ctrlKey && !be.altKey && !be.metaKey && !be.shiftKey && k === "y") {

                                try {

                                  mod.trigger("keyboard", "redo", null);

                                } catch {

                                  if (!runEditorAction("redo")) runEditorAction("editor.action.redo");

                                }

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (handleAppKeyDown(be)) {

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                              }

                            });

                            mod.focus();

                          }}

                          options={{

                            readOnly: true,
                            renderSideBySide: false,
                            fontSize: 13,
                            fontFamily:
                              '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontLigatures: true,
                            minimap: { enabled: true },
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            automaticLayout: true,
                            smoothScrolling: true,
                            cursorSmoothCaretAnimation: "off",
                            cursorBlinking: "expand",
                            padding: { top: 8, bottom: 8 },

                          }}

                        />

                      ) : (

                        <Editor

                          height="100%"

                          theme={themeName}

                          language={activeTab.language}

                          beforeMount={handleMonacoBeforeMount}

                          value={activeTab.content}

                          onChange={(v) => {

                            const next = v ?? "";

                            setTabs((prev) =>

                              prev.map((t) =>

                                t.path === activeTab.path

                                  ? { ...t, content: next, isDirty: true }

                                  : t

                              )

                            );

                          }}

                          onMount={(ed) => {

                            editorRef.current = ed;

                            bindMonacoShortcuts(ed);

                            cursorListenerDisposeRef.current?.dispose();

                            cursorListenerDisposeRef.current = ed.onDidChangeCursorPosition((ev) => {

                              const p = ev.position;

                              setCursorPos({ line: p.lineNumber, col: p.column });

                            });

                            const p = ed.getPosition();

                            if (p) setCursorPos({ line: p.lineNumber, col: p.column });



                            editorKeydownDisposeRef.current?.dispose();

                            editorKeydownDisposeRef.current = ed.onKeyDown((ev) => {

                              const be = (ev as any)?.browserEvent as KeyboardEvent | undefined;

                              if (!be) return;

                              try {

                                if (localStorage.getItem("pompora.debug.shortcuts") === "1") {

                                  // eslint-disable-next-line no-console

                                  console.log("[monaco]", { key: be.key, code: (be as any).code, ctrl: be.ctrlKey, shift: be.shiftKey, alt: be.altKey, meta: be.metaKey });

                                }

                              } catch {

                              }

                              const evRaw = __eventToShortcut(be);

                              const evNorm = evRaw ? __normShortcut(evRaw) : "";

                              const chatToggleNorm = chatToggleNormRef.current;

                              if (localStorage.getItem("pompora.debug.shortcuts") === "1") {

                                // eslint-disable-next-line no-console

                                console.log("[monaco.chat]", { evNorm, chatToggleNorm });

                              }

                              if (evNorm && chatToggleNorm && evNorm === chatToggleNorm) {

                                setIsChatDockOpen((v) => !v);

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }



                              const k = String(be.key || "").toLowerCase();

                              if (be.altKey && !be.ctrlKey && !be.metaKey && (be.key === "ArrowLeft" || be.key === "Left")) {

                                goBack();

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.altKey && !be.ctrlKey && !be.metaKey && (be.key === "ArrowRight" || be.key === "Right")) {

                                goForward();

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.ctrlKey && !be.altKey && !be.metaKey && !be.shiftKey && k === "z") {

                                try {

                                  ed.trigger("keyboard", "undo", null);

                                } catch {

                                  if (!runEditorAction("undo")) runEditorAction("editor.action.undo");

                                }

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.ctrlKey && !be.altKey && !be.metaKey && be.shiftKey && k === "z") {

                                try {

                                  ed.trigger("keyboard", "redo", null);

                                } catch {

                                  if (!runEditorAction("redo")) runEditorAction("editor.action.redo");

                                }

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (be.ctrlKey && !be.altKey && !be.metaKey && !be.shiftKey && k === "y") {

                                try {

                                  ed.trigger("keyboard", "redo", null);

                                } catch {

                                  if (!runEditorAction("redo")) runEditorAction("editor.action.redo");

                                }

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                                return;

                              }

                              if (handleAppKeyDown(be)) {

                                try {

                                  be.preventDefault();

                                  be.stopPropagation();

                                  (be as any).stopImmediatePropagation?.();

                                } catch {

                                }

                                ev.preventDefault();

                                ev.stopPropagation();

                              }

                            });

                            ed.focus();

                          }}

                          options={{

                            fontSize: 13,

                            fontFamily:

                              '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',

                            fontLigatures: true,

                            minimap: { enabled: true },

                            scrollBeyondLastLine: false,

                            wordWrap: "on",

                            automaticLayout: true,

                            smoothScrolling: true,

                            cursorSmoothCaretAnimation: "off",

                            cursorBlinking: "expand",

                            padding: { top: 8, bottom: 8 },

                          }}

                        />

                      )}



                      {activeChat.changeSet && changeWriteFiles.length ? (

                        <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2">

                          <div className="pointer-events-auto flex items-center gap-2 ws-change-bar min-w-[373px] min-h-[35px]">

                            <button

                              type="button"

                              className="ws-icon-btn"

                              disabled={changeWriteFiles.findIndex((f) => f.path === (selectedChangePath ?? "")) <= 0}

                              onClick={() => {

                                const idx = changeWriteFiles.findIndex((f) => f.path === (selectedChangePath ?? ""));

                                const prev = idx > 0 ? changeWriteFiles[idx - 1] : null;

                                if (prev?.kind === "write") {

                                  setSelectedChangePath(prev.path);

                                  void openFile(prev.path);

                                }

                              }}

                            >

                              <ChevronLeft className="h-4 w-4" />

                            </button>



                            <div className="max-w-[42vw] truncate text-[11px] text-muted">

                              {(() => {

                                const idx = changeWriteFiles.findIndex((f) => f.path === (selectedChangePath ?? ""));

                                const n = idx >= 0 ? idx + 1 : 1;

                                return `${n} of ${changeWriteFiles.length} · ${selectedChangePath ?? changeWriteFiles[0]!.path}`;

                              })()}

                            </div>



                            <button

                              type="button"

                              className="ws-icon-btn"

                              disabled={

                                changeWriteFiles.findIndex((f) => f.path === (selectedChangePath ?? "")) >=

                                changeWriteFiles.length - 1

                              }

                              onClick={() => {

                                const idx = changeWriteFiles.findIndex((f) => f.path === (selectedChangePath ?? ""));

                                const next = idx >= 0 ? changeWriteFiles[idx + 1] : null;

                                if (next?.kind === "write") {

                                  setSelectedChangePath(next.path);

                                  void openFile(next.path);

                                }

                              }}

                            >

                              <ChevronRight className="h-4 w-4" />

                            </button>



                            <button

                              type="button"

                              disabled={chatApplying || !selectedChangePath}

                              className="ws-btn ws-btn-secondary h-7 px-2"

                              onClick={() => {

                                if (!selectedChangePath) return;

                                void rejectFileChange(selectedChangePath);

                              }}

                            >

                              Reject File

                            </button>

                            <button

                              type="button"

                              disabled={chatApplying || !selectedChangePath}

                              className="ws-btn ws-btn-secondary h-7 px-5 bg-accent hover:opacity-90"

                              onClick={() => {

                                if (!selectedChangePath) return;

                                acceptFileChange(selectedChangePath);

                              }}

                            >

                              Accept File

                            </button>

                          </div>

                        </div>

                      ) : null}

                      </div>

                    </div>

                  </>

                )}

              </div>



              {isTerminalOpen ? (

                <div className="relative bg-panel" style={{ height: terminalHeight }}>

                  <div

                    className="absolute left-0 top-0 z-20 h-1 w-full cursor-row-resize"

                    onMouseDown={(e) => {

                      terminalResizeStateRef.current = { startY: e.clientY, startH: terminalHeight };

                    }}

                  />



                  <div className="flex h-full min-h-0 flex-col">

                    <div className="flex items-center justify-between bg-panel px-2 py-1.5">

                      <div className="flex min-w-0 items-center gap-1">

                        {([

                          { id: "problems", label: "Problems" },

                          { id: "output", label: "Output" },

                          { id: "debug", label: "Debug Console" },

                          { id: "terminal", label: "Terminal" },

                          { id: "ports", label: "Ports" },

                        ] as const).map((t) => (

                          <button

                            key={t.id}

                            type="button"

                            className={`rounded-md px-2 py-1 text-[11px] ${

                              panelTab === t.id ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"

                            }`}

                            onClick={() => {

                              setPanelTab(t.id);

                              if (t.id === "terminal") {

                                window.setTimeout(() => {

                                  void ensureTerminal().then(() => {

                                    resizeTerminal();

                                    termRef.current?.focus();

                                  });

                                }, 0);

                              }

                            }}

                          >

                            {t.label}

                          </button>

                        ))}

                      </div>



                      <div className="flex items-center gap-1">

                        <button

                          type="button"

                          className="ws-icon-btn"

                          onClick={() => {

                            setPanelTab("terminal");

                            window.setTimeout(() => {

                              void ensureTerminal().then(() => {

                                resizeTerminal();

                                termRef.current?.focus();

                              });

                            }, 0);

                          }}

                        >

                          <Terminal className="h-4 w-4" />

                        </button>

                        <button type="button" className="ws-icon-btn" onClick={() => void closeTerminal()}>

                          <X className="h-4 w-4" />

                        </button>

                      </div>

                    </div>



                    <div className="relative min-h-0 flex-1 bg-bg">

                      <div className={panelTab === "terminal" ? "absolute inset-0" : "absolute inset-0 hidden"}>

                        <div ref={termHostRef} className="h-full w-full" />

                      </div>

                      {panelTab !== "terminal" ? (

                        <div className="absolute inset-0 p-3 text-xs text-muted">{panelTab} is coming next.</div>

                      ) : null}

                    </div>

                  </div>

                </div>

              ) : null}

            </div>

          </main>



          {isChatDockOpen ? (

            <aside className="relative min-h-0 min-w-0 overflow-hidden rounded-2xl bg-panel">

              <div

                className="absolute left-0 top-0 z-20 h-full w-1 cursor-col-resize"

                onMouseDown={(e) => {

                  chatResizeStateRef.current = { startX: e.clientX, startW: chatDockWidth };

                }}

              />

              <div className="flex h-full min-h-0 flex-col">

                {activeChat.changeSet ? (

                  <div className="px-3 pt-2">

                    <div className="rounded-lg bg-[rgb(var(--p-panel2))] px-2 py-1">

                      <div className="flex items-center justify-between gap-2">

                        <button

                          type="button"

                          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[rgb(var(--p-panel))]"

                          onClick={() => setIsChangeSummaryOpen((v) => !v)}

                        >

                          <ChevronDown className={`h-4 w-4 text-muted ${isChangeSummaryOpen ? "rotate-180" : ""}`} />

                          <div className="min-w-0 text-[11px] text-muted">

                            <span className="text-text">{activeChat.changeSet.stats.files} files</span>

                            <span className="ml-2 text-emerald-300">+{activeChat.changeSet.stats.added}</span>

                            <span className="ml-2 text-red-300">-{activeChat.changeSet.stats.removed}</span>

                          </div>

                        </button>



                        <div className="flex shrink-0 items-center gap-2">

                          <button

                            type="button"

                            disabled={chatApplying}

                            className="ws-btn ws-btn-secondary h-7 px-2"

                            onClick={() => void rejectAllChanges()}

                          >

                            Reject all

                          </button>

                          <button

                            type="button"

                            disabled={chatApplying}

                            className="ws-btn h-7 border border-accent bg-accent px-2 text-white hover:opacity-90 disabled:opacity-50"

                            onClick={() => acceptAllChanges()}

                          >

                            Accept all

                          </button>

                        </div>

                      </div>



                      {isChangeSummaryOpen ? (

                        <div className="mt-2">

                          <div className="max-h-56 overflow-auto">

                            {activeChat.changeSet.files.map((f, idx) => {

                              const isWrite = f.kind === "write";

                              const isSelected = isWrite && selectedChangePath === f.path;

                              const kindLabel = f.kind === "write" ? "M" : f.kind === "delete" ? "D" : "R";

                              const kindClass =

                                f.kind === "write"

                                  ? "bg-emerald-500/15 text-emerald-300"

                                  : f.kind === "delete"

                                    ? "bg-red-500/15 text-red-300"

                                    : "bg-sky-500/15 text-sky-300";

                              return (

                                <div

                                  key={`${f.kind}:${f.path}:${idx}`}

                                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${

                                    isSelected ? "bg-[rgb(var(--p-panel))]" : "hover:bg-[rgb(var(--p-panel))]"

                                  }`}

                                >

                                  <button

                                    type="button"

                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"

                                    onClick={() => {

                                      if (isWrite) {

                                        setSelectedChangePath(f.path);

                                        void openFile(f.path);

                                      }

                                    }}

                                  >

                                    <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] ${kindClass}`}>{kindLabel}</span>

                                    <span className={`min-w-0 truncate text-[11px] ${isWrite ? "text-text" : "text-muted"}`}>{f.path}</span>

                                  </button>



                                  {isWrite ? (

                                    <div className="flex shrink-0 items-center gap-1">

                                      <button

                                        type="button"

                                        disabled={chatApplying}

                                        className="ws-btn ws-btn-secondary h-6 px-2 text-[11px]"

                                        onClick={() => void rejectFileChange(f.path)}

                                      >

                                        Revert

                                      </button>

                                      <button

                                        type="button"

                                        disabled={chatApplying}

                                        className="ws-btn ws-btn-secondary h-6 px-2 text-[11px]"

                                        onClick={() => acceptFileChange(f.path)}

                                      >

                                        Accept

                                      </button>

                                    </div>

                                  ) : null}

                                </div>

                              );

                            })}

                          </div>

                        </div>

                      ) : null}

                    </div>

                  </div>

                ) : null}



                <div className="relative bg-panel px-3 py-2" ref={chatHistoryMenuRef}>

                  <div className="flex items-center justify-between gap-2">

                    <div className="min-w-0">

                      <div className="truncate text-[13px] font-normal leading-none text-[#a39d9d]">{activeChat.title}</div>

                    </div>



                    <div className="flex shrink-0 items-center gap-1">

                      <button

                        ref={chatHistoryBtnRef}

                        type="button"

                        className="ws-icon-btn"

                        onClick={() => {

                          setIsChatHistoryOpen((v) => {

                            const next = !v;

                            if (next) {

                              setChatHistoryQueryDraft("");

                              setChatHistoryQuery("");

                            }

                            return next;

                          });

                        }}

                      >

                        <History className={`h-4 w-4 text-muted ${isChatHistoryOpen ? "text-text" : ""}`} />

                      </button>

                      <button

                        type="button"

                        className="ws-icon-btn"

                        onClick={() => {

                          const now = Date.now();

                          const id = `${now}-${Math.random().toString(16).slice(2)}`;

                          setChatSessions((prev) => [

                            ...prev,

                            { id, title: nextChatTitle, createdAt: now, updatedAt: now, messages: [], logs: [], draft: "", changeSet: null },

                          ]);

                          setActiveChatId(id);

                          setIsChatHistoryOpen(false);

                        }}

                      >

                        <Plus className="h-4 w-4" />

                      </button>

                      <button type="button" className="ws-icon-btn" onClick={() => setIsChatDockOpen(false)}>

                        <X className="h-4 w-4" />

                      </button>

                    </div>

                  </div>



                  {isChatHistoryOpen ? (

                    <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 px-3">

                      <div className="flex w-full max-h-[min(520px,calc(100vh-220px))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-panel shadow">

                        <div className="flex shrink-0 items-center gap-2 bg-panel2 px-3 py-2">

                          <div className="flex min-w-0 flex-1 items-center gap-2">

                            <Search className="h-4 w-4 text-muted" />

                            <input

                              className="w-full bg-transparent text-sm text-text placeholder:text-muted focus-visible:outline-none"

                              placeholder="Search chats"

                              value={chatHistoryQueryDraft}

                              onChange={(e) => setChatHistoryQueryDraft(e.currentTarget.value)}

                              autoFocus

                            />

                          </div>

                        </div>



                        <div className="min-h-0 flex-1 overflow-auto p-1">

                          {chatHistorySessions.length ? (

                            chatHistorySessions.map((s) => {

                              return (

                                <button

                                  key={s.id}

                                  type="button"

                                  className={`group relative flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left focus-visible:outline-none hover:bg-bg ${

                                    s.id === activeChatId ? "bg-bg" : ""

                                  }`}

                                  onClick={() => {

                                    setActiveChatId(s.id);

                                    setIsChatHistoryOpen(false);

                                    window.setTimeout(() => chatComposerRef.current?.focus(), 0);

                                  }}

                                >

                                  <div className="min-w-0 flex-1">

                                    <div className="truncate text-[12px] text-text">{s.title}</div>

                                    <div className="truncate text-[11px] text-muted">{formatRelTime(s.updatedAt)}</div>

                                  </div>



                                  <div className="flex shrink-0 items-center gap-1">

                                    <button

                                      type="button"

                                      className="ws-icon-btn h-7 w-7 rounded-xl bg-panel2 active:bg-bg"

                                      onClick={(e) => {

                                        e.stopPropagation();

                                        renameChatSession(s.id);

                                      }}

                                      aria-label="Rename chat"

                                    >

                                      <Pencil className="h-4 w-4" />

                                    </button>

                                    <button

                                      type="button"

                                      className="ws-icon-btn h-7 w-7 rounded-xl bg-panel2 active:bg-bg"

                                      onClick={(e) => {

                                        e.stopPropagation();

                                        deleteChatSession(s.id);

                                      }}

                                      aria-label="Delete chat"

                                    >

                                      <Trash2 className="h-4 w-4" />

                                    </button>

                                  </div>

                                </button>

                              );

                            })

                          ) : (

                            <div className="px-3 py-4 text-xs text-muted">No chats yet.</div>

                          )}

                        </div>

                      </div>

                    </div>

                  ) : null}

                </div>



                <div className="relative min-h-0 flex-1 overflow-hidden bg-[rgb(var(--p-panel)/0.82)]">

                  {!activeChat.messages.length ? (

                    <div aria-hidden="true">

                      <div className="ws-chat-bg-tint" />

                      <div className="ws-chat-bg-static">

                        <div className="ws-chat-bg-layer" />

                      </div>

                    </div>

                  ) : null}

                  <div

                    ref={chatScrollRef}

                    className={`ws-chat-scroll relative z-10 h-full overflow-y-auto overflow-x-hidden bg-transparent px-3 py-3 ${

                      canUseAi && !activeChat.messages.length ? "flex items-center justify-center" : ""

                    }`}

                    onScroll={(e) => {

                      syncChatStickinessFromEl(e.currentTarget);

                    }}

                  >

                  {aiBlockedReason && !(settings.active_provider === "pompora" && !authProfile) ? (

                    <div className="mb-3 rounded-lg border border-border bg-bg p-3 text-sm text-muted">

                      {aiBlockedReason}

                    </div>

                  ) : null}



                  {activeChat.messages.length ? (

                      <div className="space-y-3">

                        {(activeChat.messages ?? []).filter((m) => m.role !== "meta").map((m, idx) => {

                          return (

                            <div key={m.id ?? idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>

                              <div className="max-w-[92%]">

                                {m.role === "assistant" && m.kind === "event_stream" && m.eventStream ? (

                                  <EventStreamCard

                                    es={m.eventStream}

                                    onOpenFileDiff={(path) => {

                                      const cs = activeChat.changeSet;

                                      if (cs && cs.files.some((f) => f.kind === "write" && f.path === path)) {

                                        setIsChatDockOpen(true);

                                        setSelectedChangePath(path);

                                      }

                                      void openFile(path);

                                    }}

                                  />

                                ) : m.role === "assistant" && m.kind === "activity" && m.activity ? (

                                  <div className="ws-msg ws-msg-anim ws-msg-assistant">

                                    <div className="flex items-start justify-between gap-3">

                                      <div className="min-w-0">

                                        <div className="text-[11px] text-muted">Activity</div>

                                        <div className="mt-1 text-[13px] text-text">{m.activity.title}</div>

                                      </div>

                                      <div className="shrink-0 text-right">

                                        <div className="flex items-center justify-end gap-2">

                                          {m.activity.status === "running" ? (

                                            <RotateCw className="h-3.5 w-3.5 text-muted animate-spin" />

                                          ) : m.activity.status === "done" ? (

                                            <Check className="h-3.5 w-3.5 text-emerald-300" />

                                          ) : m.activity.status === "error" ? (

                                            <AlertTriangle className="h-3.5 w-3.5 text-red-300" />

                                          ) : null}

                                          <span

                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusPillClass(

                                              m.activity.status

                                            )}`}

                                          >

                                            {m.activity.status}

                                          </span>

                                        </div>

                                      </div>

                                    </div>



                                    {m.activity.progress ? (

                                      <div className="mt-2">

                                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">

                                          <span className="truncate">

                                            {m.activity.progress.current ? m.activity.progress.current : ""}

                                          </span>

                                          <span className="shrink-0">

                                            {m.activity.progress.done}/{m.activity.progress.total}

                                          </span>

                                        </div>

                                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-border bg-bg">

                                          <div

                                            className="h-full bg-accent transition-[width] duration-300"

                                            style={{

                                              width: `${Math.max(

                                                0,

                                                Math.min(

                                                  100,

                                                  Math.round(

                                                    (100 * (m.activity.progress.total ? m.activity.progress.done : 0)) /

                                                      Math.max(1, m.activity.progress.total)

                                                  )

                                                )

                                              )}%`,

                                            }}

                                          />

                                        </div>

                                      </div>

                                    ) : null}



                                    {(m.activity.steps?.length ?? 0) > 0 ? (

                                      <div className="mt-2 space-y-1">

                                        {(m.activity.steps ?? []).slice(-6).map((s, idx) => (

                                          <div key={idx} className="text-[11px] text-muted whitespace-pre-wrap break-words">

                                            {s}

                                          </div>

                                        ))}

                                      </div>

                                    ) : null}



                                    {(m.activity.details?.length ?? 0) > 0 ? (

                                      <div className="mt-2">

                                        <button

                                          type="button"

                                          className="ws-btn ws-btn-secondary h-6 px-2 text-[11px]"

                                          onClick={() => toggleActivityCollapsed(m.id ?? "")}

                                        >

                                          {m.activity.collapsed ? "Show details" : "Hide details"}

                                        </button>



                                        {!m.activity.collapsed ? (

                                          <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-border bg-bg p-2 font-mono text-[11px] text-muted">

                                            {(m.activity.details ?? []).slice(-120).map((line, idx) => (

                                              <div key={idx} className="whitespace-pre-wrap break-words">

                                                {line}

                                              </div>

                                            ))}

                                          </div>

                                        ) : null}

                                      </div>

                                    ) : null}

                                  </div>

                                ) : m.role === "assistant" && m.kind === "run_request" && m.run ? (

                                  <div className="ws-msg ws-msg-anim ws-msg-assistant" data-run-menu-root>

                                    <div className="flex items-center justify-between gap-3">

                                      <div className="min-w-0">

                                        <div className="text-[11px] text-muted">Run</div>

                                        <div className="mt-1 font-mono text-[12px] text-text">

                                          <span className="rounded border border-border bg-bg px-2 py-1">{m.run.cmd}</span>

                                        </div>

                                        {m.run.error ? (

                                          <div className="mt-2 rounded border border-red-500/30 bg-bg px-2 py-1 text-[11px] text-muted">

                                            {m.run.error}

                                          </div>

                                        ) : null}

                                      </div>

                                      <div className="shrink-0 text-right">

                                        <div className="text-[10px] text-muted">Status</div>

                                        <div className="mt-1 text-[11px] text-text">{m.run.status}</div>

                                      </div>

                                    </div>



                                    <div className="mt-2 flex items-center justify-end gap-2">

                                      <button

                                        type="button"

                                        className="ws-btn ws-btn-secondary h-7 px-2"

                                        disabled={m.run.status !== "pending"}

                                        onClick={() => cancelRunCard(m.id ?? "")}

                                      >

                                        Cancel

                                      </button>



                                      {m.run.status === "done" && m.run.error ? (

                                        <button

                                          type="button"

                                          className="ws-btn ws-btn-secondary h-7 px-2"

                                          onClick={() => void askAiToFixRunError(m.id ?? "")}

                                        >

                                          Fix

                                        </button>

                                      ) : null}



                                      <div className="relative">

                                        <button

                                          type="button"

                                          className="ws-btn ws-btn-primary h-7 px-3"

                                          disabled={m.run.status !== "pending"}

                                          onClick={() => void runFromRunCard(m.id ?? "", "once")}

                                        >

                                          Run

                                        </button>

                                        <button

                                          type="button"

                                          className="ml-1 ws-icon-btn h-7 w-7 rounded-lg border border-border bg-panel disabled:opacity-50"

                                          disabled={m.run.status !== "pending"}

                                          onClick={() => setRunMenuOpenId((v) => (v === (m.id ?? "") ? null : (m.id ?? "")))}

                                        >

                                          <ChevronDown className="h-3.5 w-3.5" />

                                        </button>



                                        {runMenuOpenId === (m.id ?? "") ? (

                                          <div className="absolute right-0 top-full z-[9999] mt-1 w-56 overflow-hidden rounded-xl border border-border bg-panel p-1 shadow">

                                            <MenuItem

                                              label="Run once"

                                              onClick={() => {

                                                setRunMenuOpenId(null);

                                                void runFromRunCard(m.id ?? "", "once");

                                              }}

                                            />

                                            <MenuItem

                                              label="Always allow & run"

                                              onClick={() => {

                                                setRunMenuOpenId(null);

                                                void runFromRunCard(m.id ?? "", "always");

                                              }}

                                            />

                                          </div>

                                        ) : null}

                                      </div>

                                    </div>



                                    {Array.isArray(m.run.remaining) && m.run.remaining.length ? (

                                      <div className="mt-2 text-[11px] text-muted">

                                        Next: <span className="font-mono">{m.run.remaining[0]}</span>

                                      </div>

                                    ) : null}

                                  </div>

                                ) : (

                                  <div className={`ws-msg ws-msg-anim ${m.role === "user" ? "ws-msg-user" : "ws-msg-assistant"}`}>

                                    <div className="whitespace-pre-wrap break-words">{m.content}</div>

                                  </div>

                                )}



                                {m.role === "assistant" ? (

                                  <div className="mt-1 flex items-center gap-1">

                                    <button

                                      type="button"

                                      className={`ws-icon-btn ${m.rating === "up" ? "text-text" : ""}`}

                                      onClick={() => {

                                        const idx = activeChat.messages.findIndex((x) => x === m);

                                        if (idx >= 0) setMessageRating(idx, "up");

                                      }}

                                    >

                                      <ThumbsUp className="h-4 w-4" />

                                    </button>

                                    <button

                                      type="button"

                                      className={`ws-icon-btn ${m.rating === "down" ? "text-text" : ""}`}

                                      onClick={() => {

                                        const idx = activeChat.messages.findIndex((x) => x === m);

                                        if (idx >= 0) setMessageRating(idx, "down");

                                      }}

                                    >

                                      <ThumbsDown className="h-4 w-4" />

                                    </button>

                                  </div>

                                ) : null}

                              </div>

                            </div>

                          );

                        })}

                      </div>

                    ) : (

                      <div className="flex min-h-[240px] flex-col items-center text-center">

                        <div className="mt-2 text-[22px] font-semibold tracking-tight text-text">

                          {(() => {

                            const rawName = (authProfile?.first_name || authProfile?.email || "").trim();

                            const name = rawName ? rawName.split("@")[0] : "there";

                            const variants = [

                              `Welcome back, ${name}`,

                              `Good to see you, ${name}`,

                              `Ready when you are, ${name}`,

                              `Let’s ship, ${name}`,

                            ];

                            const idx = __stableHash(`${activeChat.id}:${name}`) % variants.length;

                            return variants[idx] ?? variants[0]!;

                          })()}

                        </div>

                        <div className="mt-1 max-w-[360px] text-sm leading-relaxed text-muted">What are we working on today?</div>



                        {!authProfile ? (

                          <div className="relative mt-6 w-full max-w-[420px]">

                            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-[radial-gradient(120%_80%_at_50%_0%,rgba(30,144,255,0.22)_0%,rgba(30,144,255,0)_58%)]" />

                            <div className="rounded-[28px] border border-border/60 bg-panel/40 p-4 shadow-[0_16px_60px_rgba(0,0,0,0.35)]">

                              <div className="flex flex-col items-center gap-3 text-center">

                                <img src="/pompora_logo_transparent.png" alt="Pompora" className="h-12 w-12 opacity-90" />

                                <div className="min-w-0">

                                  <div className="text-[13px] font-semibold text-text">Sign in to unlock Pompora AI</div>

                                  <div className="mt-1 text-[12px] leading-relaxed text-muted">

                                    Use Pompora-hosted models, sync your plan & credits, and keep your setup consistent across devices.

                                  </div>

                                </div>

                              </div>



                              <div className="mt-4 grid grid-cols-2 gap-2">

                                <button

                                  type="button"

                                  className="group inline-flex h-9 items-center justify-center gap-2 rounded-2xl bg-accent px-3 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"

                                  disabled={isAuthBusy}

                                  onClick={() => void beginDesktopAuthWithMode("login")}

                                >

                                  Log in

                                  <ChevronRight className="h-4 w-4 opacity-85" />

                                </button>

                                <button

                                  type="button"

                                  className="group inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-bg/35 px-3 text-[13px] font-medium text-text transition-colors hover:bg-panel/50 disabled:opacity-50"

                                  disabled={isAuthBusy}

                                  onClick={() => void beginDesktopAuthWithMode("signup")}

                                >

                                  Create account

                                </button>

                              </div>
                            </div>

                          </div>

                        ) : (

                          <div className="mt-5 w-full max-w-[420px]">

                            <div className="grid grid-cols-1 gap-2">

                              {[

                                {

                                  label: "Explain current file",

                                  Icon: FileText,

                                  prompt: "Explain what the currently open file does. Summarize intent, key flows, and anything risky or confusing.",

                                },

                                {

                                  label: "Find bugs",

                                  Icon: AlertTriangle,

                                  prompt: "Review the current code and list potential bugs, edge cases, and footguns. Propose minimal fixes.",

                                },

                                {

                                  label: "Refactor",

                                  Icon: Wand2,

                                  prompt: "Refactor the current code for readability and maintainability. Keep behavior the same; propose small, safe steps.",

                                },

                                {

                                  label: "Add a feature",

                                  Icon: Plus,

                                  prompt: "Help me add a small feature to the current file. Ask 2-3 clarifying questions first, then propose an implementation plan.",

                                },

                              ].map((s) => (

                                <button

                                  key={s.label}

                                  type="button"

                                  className={`group flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-bg/30 px-3 py-2 text-left transition-all hover:border-border/90 hover:bg-panel/40 active:border-border outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60 focus-visible:ring-offset-0 ${

                                    canUseAi ? "" : "cursor-not-allowed opacity-60"

                                  }`}

                                  onClick={() => {

                                    if (!canUseAi) {

                                      openSettingsTab();

                                      return;

                                    }

                                    setActiveChatDraft(s.prompt);

                                    window.setTimeout(() => {

                                      void sendChatRef.current?.();

                                    }, 0);

                                  }}

                                >

                                  <div className="flex min-w-0 items-center gap-2">

                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgb(var(--p-panel2))]">

                                      <s.Icon className="h-4 w-4 text-text" />

                                    </span>

                                    <span className="truncate text-[13px] font-medium text-text">{s.label}</span>

                                  </div>

                                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />

                                </button>

                              ))}

                            </div>

                          </div>

                        )}

                      </div>

                    )}

                </div>

                </div>



                <div className="bg-panel px-3 py-2">

                  <div className="ws-panel2 rounded-md p-2">

                    <textarea

                      ref={chatComposerRef}

                      className="h-16 w-full resize-none bg-transparent px-2 py-1 text-sm font-normal text-muted outline-none placeholder:text-muted focus-visible:outline-none"

                      placeholder="Ask anything (Ctrl+L)"

                      value={activeChat.draft}

                      onChange={(e) => setActiveChatDraft(e.currentTarget.value)}

                      onKeyDown={(e) => {

                        if (e.key === "Enter" && !e.shiftKey) {

                          e.preventDefault();

                          void sendChat();

                        }

                      }}

                    />



                    <div className="mt-2 flex items-center justify-between gap-2 px-1">

                      <div className="flex items-center gap-2">

                        <button

                          type="button"

                          className="ws-icon-btn"

                          onClick={() => notify({ kind: "info", title: "Add", message: "Coming next." })}

                        >

                          <Plus className="h-4 w-4" />

                        </button>



                        <div className="relative" data-model-picker-root>

                          <button

                            type="button"

                            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-text hover:bg-[rgb(var(--p-panel2))] focus-visible:outline-none"

                            onClick={() => {

                              void refreshProviderKeyStatuses();

                              setIsModelPickerOpen((v) => !v);

                            }}

                            onMouseEnter={(e) => {

                              if (aiBlockedReason) showTooltipForEl(e.currentTarget, aiBlockedReason, "tr");

                            }}

                            onMouseLeave={hideTooltip}

                          >

                            <span

                              className={`text-sm ${

                                settings.active_provider === "pompora"

                                  ? "text-text"

                                  : activeProviderMissingKey

                                    ? "text-muted"

                                    : providerNeedsKey

                                      ? "text-text"

                                      : "text-muted"

                              }`}

                            >

                              {providerLabel}

                            </span>

                            <ChevronDown className={`h-4 w-4 text-muted ${isModelPickerOpen ? "rotate-180" : ""}`} />

                          </button>



                          {isModelPickerOpen ? (

                            <div className="absolute left-0 bottom-full z-[9999] mb-2 w-64 max-h-[480px] overflow-hidden rounded-xl border border-border bg-panel shadow-lg" data-model-picker-root>

                              <div className="sticky top-0 z-10 border-b border-border bg-panel px-3 py-1.5">

                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Pompora</div>

                              </div>

                              <div className="max-h-[200px] overflow-y-auto">



                              {(["slow", "fast", "reasoning"] as const).map((mode) => {

                                const pomporaSt = providerKeyStatuses["pompora"];

                                const effectiveMode = String(settings.pompora_thinking ?? uiPomporaThinking ?? "slow").toLowerCase();

                                const selected = (settings.active_provider ?? "") === "pompora" && effectiveMode === mode;

                                const lockedByAuth = !authProfile;

                                const lockedByPlan = authProfile ? !pomporaAllowedModeSet.has(mode) : true;

                                const lockedByLink = authProfile ? pomporaSt?.is_configured !== true : true;

                                const disabled = lockedByAuth || lockedByPlan || lockedByLink;



                                const rightLabel =

                                  lockedByAuth ? "Log in" : mode === "reasoning" ? "Pro" : mode === "fast" ? "Plus" : "Starter";



                                const label = mode === "reasoning" ? "Pompora Reasoning" : mode === "fast" ? "Pompora Fast" : "Pompora Slow";



                                return (

                                  <button

                                    key={`pompora-${mode}`}

                                    type="button"

                                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[rgb(var(--p-panel2))] ${

                                      selected ? "bg-[rgb(var(--p-panel2))]" : ""

                                    } ${disabled ? "text-muted opacity-60" : "text-text"}`}

                                    onClick={() => {

                                      if (disabled) {

                                        openSettingsTab();

                                        setIsModelPickerOpen(false);

                                        return;

                                      }

                                      void selectPomporaMode(mode);

                                      setIsModelPickerOpen(false);

                                    }}

                                    onMouseEnter={(e) => {

                                      if (disabled) {

                                        showTooltipForEl(

                                          e.currentTarget,

                                          lockedByAuth

                                            ? "Sign in to unlock Pompora AI"

                                            : lockedByLink

                                              ? "Finish signing in to Pompora"

                                              : "Upgrade your plan to unlock this mode",

                                          "tr"

                                        );

                                      }

                                    }}

                                    onMouseLeave={hideTooltip}

                                  >

                                    <span>{label}</span>

                                    <span className="text-xs text-muted">{rightLabel}</span>

                                  </button>

                                );

                              })}

                              </div>



                              <div className="sticky top-0 z-10 border-t border-border bg-panel px-3 py-1.5">

                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Bring Your Own Key</div>

                              </div>

                              <div className="max-h-[240px] overflow-y-auto">

                                {providerChoices

                                .filter((p) => p.id !== "pompora")

                                .map((p) => {

                                  const st = providerKeyStatuses[p.id];

                                  const missingKey = p.api ? st?.is_configured !== true : false;

                                  const isActive = (settings.active_provider ?? "") === p.id;

                                  const activeModel = isActive ? (settings.active_model ?? null) : null;



                                  return (

                                    <button

                                      key={p.id}

                                      type="button"

                                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors border-b border-border/30 last:border-0 ${

                                        isActive ? "bg-accent/10 text-text" : "text-muted hover:bg-[rgb(var(--p-panel2))] hover:text-text"

                                      } ${missingKey ? "opacity-60" : ""}`}

                                      onClick={async () => {

                                        if (missingKey) {

                                          // Redirect to settings to add API key

                                          openSettingsTab();

                                          setIsModelPickerOpen(false);

                                          return;

                                        }

                                        

                                        // Select provider and load models if needed

                                        if (!isActive) {

                                          await changeProvider(p.id);

                                        }

                                        

                                        // Load models if not already loaded

                                        if (!providerModels[p.id] && !loadingModels[p.id]) {

                                          await loadProviderModels(p.id);

                                        }

                                        

                                        setIsModelPickerOpen(false);

                                      }}

                                      onMouseEnter={(e) => {

                                        if (missingKey) {

                                          showTooltipForEl(e.currentTarget, "Add API key in Settings (Ctrl+,)", "tr");

                                        }

                                      }}

                                      onMouseLeave={hideTooltip}

                                    >

                                      <div className="flex min-w-0 flex-1 items-center gap-1.5">

                                        <span className="truncate font-medium">{p.label}</span>

                                        {activeModel && (

                                          <span className="truncate text-[10px] text-muted/70">• {activeModel.split('/').pop()?.split(':').pop() || activeModel}</span>

                                        )}

                                        {missingKey && (

                                          <span className="text-[10px] text-danger/70">(key)</span>

                                        )}

                                      </div>

                                      {missingKey && <span className="text-[10px] text-muted/60">→</span>}

                                    </button>

                                  );

                                })}

                              </div>

                            </div>

                          ) : null}

                        </div>

                      </div>



                      <div className="flex items-center gap-1">

                        <button

                          type="button"

                          className="relative h-6 w-6 rounded-full focus-visible:outline-none"

                          onMouseEnter={(e) =>

                            showTooltipForEl(

                              e.currentTarget,

                              `${Math.round(chatContextUsage.pct * 100)}% (${chatContextUsage.used.toLocaleString()} / ${chatContextUsage.total.toLocaleString()}) context used`,

                              "tr"

                            )

                          }

                          onMouseLeave={hideTooltip}

                          style={{

                            background: `conic-gradient(rgb(var(--p-muted)) ${Math.round(chatContextUsage.pct * 360)}deg, rgb(var(--p-panel2)) 0deg)`,

                          }}

                        >

                          <span

                            className="absolute inset-[2px] rounded-full bg-panel"

                          />

                        </button>

                        <button

                          type="button"

                          disabled={chatBusy || !activeChat.draft.trim()}

                          className={`ws-icon-btn ${!canUseAi ? "cursor-not-allowed opacity-50" : ""}`}

                          onClick={() => {

                            if (!canUseAi) {

                              openSettingsTab();

                              return;

                            }

                            void sendChat();

                          }}

                          onMouseEnter={(e) => {

                            if (!canUseAi && aiBlockedReason) showTooltipForEl(e.currentTarget, aiBlockedReason, "tr");

                          }}

                          onMouseLeave={hideTooltip}

                        >

                          <ArrowUp className="h-4 w-4" />

                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </aside>

          ) : null}

        </div>



        <footer className="flex h-[32px] -translate-y-[1px] items-center justify-between gap-3 bg-bg px-3 pb-px text-[12px] leading-none text-muted">

          <div className="min-w-0">

            {workspace.root && footerRelPath ? (

              <FooterBreadcrumb

                workspaceLabel={workspaceLabel}

                relPath={footerRelPath}

                fileIconPath={footerFileIconPath}

                expanded={footerPathExpanded}

                onToggleExpanded={() => setFooterPathExpanded((v) => !v)}

              />

            ) : null}

          </div>



          <div className="flex items-center gap-3">

            {activeTab ? (

              <button type="button" className="ws-footer-btn" onClick={() => {}}>

                {activeTab.language}

              </button>

            ) : null}

            {activeTab ? (

              <button type="button" className="ws-footer-btn" onClick={() => {}}>

                {cursorPos ? `Ln ${cursorPos.line}, Col ${cursorPos.col}` : "Ln -, Col -"}

              </button>

            ) : null}

            {authProfile ? (

              <button type="button" className="ws-footer-btn" onClick={() => void openUrl("https://pompora.dev/pricing")}>

                {pomporaPlan === "pro" ? "Pro" : pomporaPlan === "plus" ? "Plus" : "Starter"} plan

              </button>

            ) : (

              <button type="button" className="ws-footer-btn" onClick={() => void beginDesktopAuthWithMode("login")}>

                Log in

              </button>

            )}

            <button type="button" className="ws-footer-btn" onClick={() => {}} aria-label="Notifications">

              <Bell className="h-4 w-4" />

              {notifications.length ? <span className="text-[11px]">{notifications.length}</span> : null}

            </button>

          </div>

        </footer>

      </div>



      {isPaletteOpen ? (

        <CommandPalette

          query={paletteQuery}

          setQuery={setPaletteQuery}

          commands={filteredCommands}

          index={paletteIndex}

          setIndex={setPaletteIndex}

          onClose={() => setIsPaletteOpen(false)}

          onRun={(cmd) => {

            cmd.run();

            setIsPaletteOpen(false);

          }}

        />

      ) : null}



      {textPromptDialog ? (

        <TextPromptDialog

          title={textPromptDialog.title}

          subtitle={textPromptDialog.subtitle}

          placeholder={textPromptDialog.placeholder}

          value={textPromptDialog.value}

          setValue={(v) => setTextPromptDialog((prev) => (prev ? { ...prev, value: v } : prev))}

          password={textPromptDialog.password}

          readOnly={textPromptDialog.readOnly}

          showCopy={textPromptDialog.showCopy}

          onClose={() => {

            const r = textPromptDialog.resolve;

            setTextPromptDialog(null);

            r(null);

          }}

          onSubmit={(value) => {

            const r = textPromptDialog.resolve;

            setTextPromptDialog(null);

            r(value);

          }}

        />

      ) : null}



      {confirmDialog ? (

        <ConfirmDialog

          title={confirmDialog.title}

          message={confirmDialog.message}

          confirmLabel={confirmDialog.confirmLabel}

          danger={confirmDialog.danger}

          onClose={() => {

            const r = confirmDialog.resolve;

            setConfirmDialog(null);

            r(false);

          }}

          onConfirm={() => {

            const r = confirmDialog.resolve;

            setConfirmDialog(null);

            r(true);

          }}

        />

      ) : null}



      {isQuickOpenOpen ? (

        <QuickOpen

          query={quickOpenQuery}

          setQuery={setQuickOpenQuery}

          files={fileIndex}

          index={quickOpenIndex}

          setIndex={setQuickOpenIndex}

          isLoading={isFileIndexLoading}

          onClose={() => setIsQuickOpenOpen(false)}

          onPick={(p) => {

            void openFile(p);

            setIsQuickOpenOpen(false);

          }}

        />

      ) : null}



      {isGoToLineOpen ? (

        <GoToLine

          value={goToLineValue}

          setValue={setGoToLineValue}

          onClose={() => setIsGoToLineOpen(false)}

          onGo={(n) => {

            goToLine(n);

            setIsGoToLineOpen(false);

          }}

        />

      ) : null}



      {isSavedWorkspacesOpen ? (

        <SavedWorkspacesDialog

          items={getSavedWorkspaces()}

          onClose={() => setIsSavedWorkspacesOpen(false)}

          onPick={(name) => {

            void openSavedWorkspaceByName(name);

          }}

          onRename={(name) => {

            void (async () => {

              const existing = getSavedWorkspaces();

              const ws = existing.find((x) => x.name.trim().toLowerCase() === String(name || "").trim().toLowerCase());

              if (!ws) return;

              const nextName = await requestTextPrompt("Rename workspace", ws.name, { subtitle: "Choose a new name" });

              if (!nextName) return;

              const trimmed = String(nextName).trim();

              if (!trimmed) return;

              if (trimmed.toLowerCase() !== ws.name.trim().toLowerCase()) {

                const collision = existing.find((x) => x.name.trim().toLowerCase() === trimmed.toLowerCase());

                if (collision) {

                  notify({ kind: "error", title: "Workspace", message: "A workspace with that name already exists." });

                  return;

                }

              }

              const now = Date.now();

              const nextItems = existing.map((x) =>

                x.name.trim().toLowerCase() === ws.name.trim().toLowerCase() ? { ...x, name: trimmed, updated_at: now } : x

              );

              await persistSavedWorkspaces(nextItems);

            })();

          }}

          onDelete={(name) => {

            void (async () => {

              const existing = getSavedWorkspaces();

              const ws = existing.find((x) => x.name.trim().toLowerCase() === String(name || "").trim().toLowerCase());

              if (!ws) return;

              const ok = await requestConfirm("Delete workspace", `Delete \"${ws.name}\"?`, { danger: true, confirmLabel: "Delete" });

              if (!ok) return;

              const nextItems = existing.filter((x) => x.name.trim().toLowerCase() !== ws.name.trim().toLowerCase());

              await persistSavedWorkspaces(nextItems);

            })();

          }}

        />

      ) : null}



      {savePathDialog ? (

        <SavePathDialog

          title={savePathDialog.title}

          subtitle={savePathDialog.subtitle}

          inputLabel={savePathDialog.inputLabel}

          placeholder={savePathDialog.placeholder}

          value={savePathDialog.value}

          setValue={(v) => setSavePathDialog((prev) => (prev ? { ...prev, value: v } : prev))}

          extensions={savePathDialog.extensions}

          defaultExtension={savePathDialog.defaultExtension}

          enforceExtension={savePathDialog.enforceExtension}

          onClose={() => {

            const r = savePathDialog.resolve;

            setSavePathDialog(null);

            r(null);

          }}

          onSubmit={(value) => {

            const r = savePathDialog.resolve;

            setSavePathDialog(null);

            r(value);

          }}

        />

      ) : null}



      {explorerMenu ? (

        <ContextMenu

          x={explorerMenu.x}

          y={explorerMenu.y}

          onClose={() => setExplorerMenu(null)}

          items={([

            { id: "newFolder", label: "New Folder...", icon: <Folder className="h-4 w-4" />, onClick: () => void createNewFolder() },

            { id: "sep-create", kind: "sep" as const },

            ...((explorerMenu.path === "" || explorerMenu.path.startsWith("__wsroot__/"))

              ? ([

                  { id: "refresh", label: "Refresh", icon: <RotateCw className="h-4 w-4" />, onClick: () => void refreshRoot() },

                  ...(explorerMenu.path.startsWith("__wsroot__/")

                    ? ([

                        {

                          id: "removeWorkspaceFolder",

                          label: "Remove Folder from Workspace",

                          icon: <X className="h-4 w-4" />,

                          kind: "danger" as const,

                          onClick: () => {

                            const abs = resolveAbsPathFromExplorerPath(explorerMenu.path);

                            if (abs) void removeFolderFromWorkspace(abs);

                          },

                        },

                      ] as ContextMenuItem[])

                    : ([

                        { id: "closeFolder", label: "Close Folder", icon: <X className="h-4 w-4" />, onClick: () => void closeFolder() },

                      ] as ContextMenuItem[])),

                ] as ContextMenuItem[])

              : ([

                  { id: "rename", label: "Rename...", icon: <Pencil className="h-4 w-4" />, onClick: () => void renameSelected() },

                  { id: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4" />, kind: "danger" as const, onClick: () => void deleteSelected() },

                  { id: "sep-actions", kind: "sep" as const },

                  { id: "copyPath", label: "Copy Relative Path", icon: <Clipboard className="h-4 w-4" />, onClick: () => void copyText(explorerMenu.path) },

                ] as ContextMenuItem[])),

            {

              id: "copyFullPath",

              label: "Copy Full Path",

              icon: <Clipboard className="h-4 w-4" />,

              onClick: () => {

                const abs = resolveAbsPathFromExplorerPath(explorerMenu.path);

                void copyText(abs ?? explorerMenu.path);

              },

            },

          ] as ContextMenuItem[])}

        />

      ) : null}



      {wsTooltip ? (

        <div

          className="fixed z-[9999] pointer-events-none select-none ws-msg-anim max-w-[320px] rounded-md border border-border ws-panel2 px-2 py-1 text-[11px] text-text shadow-xl"

          style={{

            left: wsTooltip.x,

            top: wsTooltip.y,

            transform:

              wsTooltip.placement === "above"

                ? wsTooltip.align === "tr"

                  ? "translate(-100%, -110%)"

                  : "translate(0, -110%)"

                : wsTooltip.align === "tr"

                  ? "translate(-100%, 10%)"

                  : "translate(0, 10%)",

          }}

        >

          {wsTooltip.text}

        </div>

      ) : null}

    </div>

  );

}



function isSubsequence(needle: string, haystack: string): boolean {

  let i = 0;

  for (let j = 0; j < haystack.length && i < needle.length; j++) {

    if (haystack[j] === needle[i]) i++;

  }

  return i === needle.length;

}



function QuickOpen(props: {

  query: string;

  setQuery: (v: string) => void;

  files: string[];

  index: number;

  setIndex: (v: number) => void;

  isLoading: boolean;

  onClose: () => void;

  onPick: (path: string) => void;

}) {

  const q = props.query.trim().toLowerCase();



  const list = useMemo(() => {

    if (!props.files.length) return [] as string[];

    if (!q) return props.files.slice(0, 60);



    const out: string[] = [];

    for (const f of props.files) {

      const lf = f.toLowerCase();

      if (lf.includes(q) || isSubsequence(q, lf)) {

        out.push(f);

        if (out.length >= 120) break;

      }

    }

    return out;

  }, [props.files, q]);



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "ArrowDown") {

        e.preventDefault();

        props.setIndex(Math.min(props.index + 1, Math.max(0, list.length - 1)));

      }

      if (e.key === "ArrowUp") {

        e.preventDefault();

        props.setIndex(Math.max(0, props.index - 1));

      }

      if (e.key === "Enter") {

        e.preventDefault();

        const p = list[props.index];

        if (p) props.onPick(p);

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [list, props]);



  return (

    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={props.onClose}>

      <div

        className="mx-auto mt-20 w-[820px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className="border-b border-border p-3">

          <input

            className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted"

            placeholder="Type to search files"

            autoFocus

            value={props.query}

            onChange={(e) => props.setQuery(e.currentTarget.value)}

          />

          <div className="mt-2 text-xs text-muted">

            {props.isLoading ? "Indexing files..." : `${props.files.length} files`}

          </div>

        </div>

        <div className="max-h-[360px] overflow-auto p-2">

          {list.length ? (

            list.map((p, i) => (

              <button

                key={p}

                type="button"

                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${

                  i === props.index ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"

                }`}

                onMouseEnter={() => props.setIndex(i)}

                onClick={() => props.onPick(p)}

              >

                <span className="flex min-w-0 items-center gap-2 truncate">

                  {(() => {

                    const Icon = fileIconFor(p);

                    return <Icon className="h-4 w-4 shrink-0" />;

                  })()}

                  <span className="min-w-0 flex-1 truncate">{p}</span>

                </span>

              </button>

            ))

          ) : (

            <div className="p-3 text-sm text-muted">No matches</div>

          )}

        </div>

      </div>

    </div>

  );

}



function GoToLine(props: {

  value: string;

  setValue: (v: string) => void;

  onClose: () => void;

  onGo: (line: number) => void;

}) {

  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "Enter") {

        e.preventDefault();

        const n = Number.parseInt(props.value.trim(), 10);

        if (Number.isFinite(n) && n > 0) props.onGo(n);

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [props]);



  return (

    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={props.onClose}>

      <div

        className="mx-auto mt-20 w-[520px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className="border-b border-border p-3">

          <div className="mb-2 text-xs font-semibold text-muted">Go to Line</div>

          <input

            className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted"

            placeholder="Line number"

            autoFocus

            value={props.value}

            onChange={(e) => props.setValue(e.currentTarget.value)}

          />

        </div>

        <div className="p-3">

          <button

            type="button"

            className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-muted hover:border-accent hover:text-text"

            onClick={() => {

              const n = Number.parseInt(props.value.trim(), 10);

              if (Number.isFinite(n) && n > 0) props.onGo(n);

            }}

          >

            Go

          </button>

        </div>

      </div>

    </div>

  );

}



function SavePathDialog(props: {

  title: string;

  subtitle?: string;

  inputLabel?: string;

  placeholder?: string;

  value: string;

  setValue: (v: string) => void;

  extensions?: string[];

  defaultExtension?: string;

  enforceExtension?: boolean;

  onClose: () => void;

  onSubmit: (value: string) => void;

}) {

  const extensions = useMemo(() => {

    const exts = (props.extensions ?? []).map((x) => String(x || "").trim().replace(/^\./, "").toLowerCase()).filter(Boolean);

    return Array.from(new Set(exts));

  }, [props.extensions]);



  const inferExtFromValue = useCallback(

    (v: string): string | null => {

      const val = String(v || "").trim();

      const base = val.split("/").pop() || "";

      const m = base.match(/\.([a-zA-Z0-9]+)$/);

      if (!m?.[1]) return null;

      const ext = m[1].toLowerCase();

      if (extensions.length && !extensions.includes(ext)) return null;

      return ext;

    },

    [extensions]

  );



  const [selectedExt, setSelectedExt] = useState<string>(() => {

    const fromValue = inferExtFromValue(props.value);

    if (fromValue) return fromValue;

    const def = String(props.defaultExtension || "").trim().replace(/^\./, "").toLowerCase();

    if (def && (!extensions.length || extensions.includes(def))) return def;

    return extensions[0] ?? "";

  });



  useEffect(() => {

    const fromValue = inferExtFromValue(props.value);

    if (fromValue) {

      setSelectedExt(fromValue);

      return;

    }

    const def = String(props.defaultExtension || "").trim().replace(/^\./, "").toLowerCase();

    if (def && (!extensions.length || extensions.includes(def))) {

      setSelectedExt(def);

      return;

    }

    if (extensions.length && !selectedExt) setSelectedExt(extensions[0]!);

  }, [extensions, inferExtFromValue, props.defaultExtension, props.value, selectedExt]);



  const normalize = useCallback(

    (raw: string): string | null => {

      const trimmed = String(raw || "").trim();

      if (!trimmed) return null;



      const norm = trimmed.replace(/\\/g, "/");

      if (!extensions.length || !selectedExt) return norm;



      const base = norm.split("/").pop() ?? "";

      const hasExt = /\.[a-zA-Z0-9]+$/.test(base);

      if (!hasExt) return `${norm}.${selectedExt}`;



      if (props.enforceExtension) {

        return norm.replace(/\.[a-zA-Z0-9]+$/, `.${selectedExt}`);

      }



      return norm;

    },

    [extensions.length, props.enforceExtension, selectedExt]

  );



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "Escape") {

        e.preventDefault();

        props.onClose();

      }

      if (e.key === "Enter") {

        e.preventDefault();

        const v = normalize(props.value);

        if (v) props.onSubmit(v);

      }

    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [normalize, props]);



  const normalizedPreview = normalize(props.value);

  const isValid = !!normalizedPreview;



  return (

    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={props.onClose}>

      <div

        className="mx-auto mt-20 w-[640px] max-w-[92vw] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className="border-b border-border p-4">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <div className="text-sm font-semibold text-text">{props.title}</div>

              {props.subtitle ? <div className="mt-0.5 text-xs text-muted">{props.subtitle}</div> : null}

            </div>

            <button type="button" className="ws-icon-btn" onClick={props.onClose} aria-label="Close">

              <X className="h-4 w-4" />

            </button>

          </div>

        </div>



        <div className="p-4">

          <div className="text-xs font-medium text-muted">{props.inputLabel ?? "File name (relative)"}</div>

          <div className="mt-2 flex items-stretch gap-2">

            <input

              className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"

              placeholder={props.placeholder ?? "folder/file"}

              autoFocus

              value={props.value}

              onChange={(e) => props.setValue(e.currentTarget.value)}

            />

            {extensions.length ? (

              <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3">

                <span className="text-xs text-muted">.</span>

                <select

                  className="bg-transparent text-sm text-text focus:outline-none"

                  value={selectedExt}

                  onChange={(e) => setSelectedExt(e.currentTarget.value)}

                >

                  {extensions.map((ext) => (

                    <option key={ext} value={ext}>

                      {ext}

                    </option>

                  ))}

                </select>

              </div>

            ) : null}

          </div>



          <div className="mt-2 text-xs">

            {isValid ? (

              <span className="text-muted">

                Will save as <span className="text-text">{normalizedPreview}</span>

              </span>

            ) : (

              <span className="text-red-300">Enter a file name</span>

            )}

          </div>

        </div>



        <div className="flex items-center justify-between gap-2 border-t border-border bg-bg/30 p-4">

          <div className="text-xs text-muted">Enter to confirm • Esc to cancel</div>

          <div className="flex items-center gap-2">

          <button

            type="button"

            className="ws-btn ws-btn-secondary h-9 px-4"

            onClick={props.onClose}

          >

            Cancel

          </button>

          <button

            type="button"

            disabled={!isValid}

            className="ws-btn h-9 border border-accent bg-accent px-4 text-white hover:opacity-90 disabled:opacity-50"

            onClick={() => {

              const v = normalize(props.value);

              if (v) props.onSubmit(v);

            }}

          >

            OK

          </button>

          </div>

        </div>

      </div>

    </div>

  );

}



function ActivityButton(props: {

  id: ActivityId;

  active: boolean;

  onClick: (id: ActivityId) => void;

  Icon: typeof FolderOpen;

}) {

  const { id, active, onClick, Icon } = props;

  return (

    <button

      type="button"

      className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors ${

        active ? "bg-panel2 text-text" : "bg-panel text-muted hover:bg-panel2 hover:text-text"

      }`}

      onClick={() => onClick(id)}

      aria-current={active ? "page" : undefined}

    >

      <span

        aria-hidden

        className={`absolute left-[-10px] top-1.5 h-6 w-0.5 rounded bg-accent transition-opacity ${

          active ? "opacity-100" : "opacity-0"

        }`}

      />

      <Icon className="h-5 w-5" />

    </button>

  );

}



function Panel(props: { title: string; children: React.ReactNode }) {

  return (

    <div className="flex h-full flex-col">

      <div className="bg-panel px-3 py-2 text-xs font-normal text-muted">

        {props.title}

      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">{props.children}</div>

    </div>

  );

}



function Explorer(props: {

  workspaceRoot: string | null;

  recent: string[];

  explorer: Record<string, DirEntryInfo[]>;

  expandedDirs: Set<string>;

  selectedPath: string | null;

  inlineRenamePath: string | null;

  inlineRenameValue: string;

  onInlineRenameValue: (v: string) => void;

  onInlineRenameCommit: () => void;

  onInlineRenameCancel: () => void;

  onContextMenu: (info: { x: number; y: number; path: string; isDir: boolean }) => void;

  showTooltipForEl: (el: HTMLElement, text: string, align?: "tl" | "tr") => void;

  hideTooltip: () => void;

  onOpenFolder: () => void;

  onOpenStandaloneFile: () => void;

  onOpenRecent: (p: string) => void;

  onToggleDir: (dir: string) => void;

  onSelect: (p: string) => void;

  onOpenFile: (p: string) => void;

  onRefresh: () => void;

  onCreateNewFolder: () => void;

}) {

  if (!props.workspaceRoot) {

    return (

      <Panel title="Explorer">

        <WelcomeScreen

          title="No folder open"

          subtitle="Open a folder to browse files and start editing."

          onOpenFolder={props.onOpenFolder}

          onOpenFile={props.onOpenStandaloneFile}

          recentWorkspaces={props.recent}

          recentFiles={[]}

          onOpenRecentWorkspace={props.onOpenRecent}

          onOpenRecentFile={undefined}

          onOpenChat={undefined}

          onOpenCommandPalette={undefined}

          onCreateNewFile={undefined}

          useBrandFont={false}

          compact

        />

      </Panel>

    );

  }



  const rootEntries = props.explorer[""] ?? [];

  const isMultiRoot = rootEntries.some((e) => String(e.path || "").startsWith("__wsroot__/"));

  const rootNode: DirEntryInfo = {

    path: "",

    name: basename(props.workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "")),

    is_dir: true,

  };



  return (

    <div className="flex h-full flex-col">

      <div className="flex items-center justify-between border-border bg-panel px-3 py-2">

        <div className="text-xs font-normal text-muted">Explorer</div>

        <div className="flex items-center gap-1">

          <button

            type="button"

            className="ws-icon-btn"

            onClick={props.onCreateNewFolder}

          >

            <Folder className="h-4 w-4" />

          </button>

          <button

            type="button"

            className="ws-icon-btn"

            onClick={props.onRefresh}

          >

            <RotateCw className="h-4 w-4" />

          </button>

        </div>

      </div>



      <div className="min-h-0 flex-1 overflow-auto p-1">

        <Tree

          prefix=""

          depth={0}

          entries={isMultiRoot ? rootEntries : [rootNode]}

          explorer={props.explorer}

          expandedDirs={props.expandedDirs}

          selectedPath={props.selectedPath}

          inlineRenamePath={props.inlineRenamePath}

          inlineRenameValue={props.inlineRenameValue}

          onInlineRenameValue={props.onInlineRenameValue}

          onInlineRenameCommit={props.onInlineRenameCommit}

          onInlineRenameCancel={props.onInlineRenameCancel}

          onContextMenu={props.onContextMenu}

          workspaceRoot={props.workspaceRoot}

          showTooltipForEl={props.showTooltipForEl}

          hideTooltip={props.hideTooltip}

          onToggleDir={props.onToggleDir}

          onSelect={props.onSelect}

          onOpenFile={props.onOpenFile}

        />

      </div>

    </div>

  );

}



function Tree(props: {

  prefix: string;

  depth: number;

  entries: DirEntryInfo[];

  explorer: Record<string, DirEntryInfo[]>;

  expandedDirs: Set<string>;

  selectedPath: string | null;

  inlineRenamePath: string | null;

  inlineRenameValue: string;

  onInlineRenameValue: (v: string) => void;

  onInlineRenameCommit: () => void;

  onInlineRenameCancel: () => void;

  onContextMenu: (info: { x: number; y: number; path: string; isDir: boolean }) => void;

  workspaceRoot: string | null;

  showTooltipForEl: (el: HTMLElement, text: string, align?: "tl" | "tr") => void;

  hideTooltip: () => void;

  onToggleDir: (dir: string) => void;

  onSelect: (p: string) => void;

  onOpenFile: (p: string) => void;

}) {

  const hoverTimerRef = useRef<number | null>(null);



  useEffect(() => {

    return () => {

      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = null;

    };

  }, []);



  return (

    <div className="space-y-0.5">

      {props.entries.map((e) => {

        const indentPx = 8 + props.depth * 14;

        const isSelected = props.selectedPath === e.path;

        const rowCls = isSelected

          ? "bg-[rgb(var(--p-panel2))] text-text shadow-sm"

          : "text-muted hover:bg-panel hover:text-text";

        if (e.is_dir) {

          const isExpanded = props.expandedDirs.has(e.path);

          const children = props.explorer[e.path] ?? [];

          const isRoot = e.path === "";

          return (

            <div key={e.path}>

              <button

                type="button"

                className={`group relative flex w-full items-center gap-2 rounded-none pr-2 py-1 text-left text-[13px] leading-4 transition-all duration-150 ${rowCls}`}

                style={{ paddingLeft: indentPx }}

                onClick={() => {

                  props.onSelect(e.path);

                  props.onToggleDir(e.path);

                }}

                onContextMenu={(ev) => {

                  ev.preventDefault();

                  props.onSelect(e.path);

                  props.onContextMenu({ x: ev.clientX, y: ev.clientY, path: e.path, isDir: true });

                }}

              >

                <ChevronRight

                  className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-hover:text-text ${isExpanded ? "rotate-90" : ""}`}

                />

                {isRoot ? (

                  <FolderOpen className="h-4 w-4 shrink-0 text-muted group-hover:text-text" />

                ) : (

                  <Folder className="h-4 w-4 shrink-0 text-muted group-hover:text-text" />

                )}

                <span className={`relative top-[0.5px] truncate ${isRoot ? "font-medium text-text" : ""}`}>{e.name}</span>

              </button>

              {isExpanded ? (

                <Tree

                  prefix={e.path}

                  depth={props.depth + 1}

                  entries={children}

                  explorer={props.explorer}

                  expandedDirs={props.expandedDirs}

                  selectedPath={props.selectedPath}

                  inlineRenamePath={props.inlineRenamePath}

                  inlineRenameValue={props.inlineRenameValue}

                  onInlineRenameValue={props.onInlineRenameValue}

                  onInlineRenameCommit={props.onInlineRenameCommit}

                  onInlineRenameCancel={props.onInlineRenameCancel}

                  onContextMenu={props.onContextMenu}

                  workspaceRoot={props.workspaceRoot}

                  showTooltipForEl={props.showTooltipForEl}

                  hideTooltip={props.hideTooltip}

                  onToggleDir={props.onToggleDir}

                  onSelect={props.onSelect}

                  onOpenFile={props.onOpenFile}

                />

              ) : null}

            </div>

          );

        }



        const Icon = fileIconFor(e.path);

        if (props.inlineRenamePath === e.path) {

          return (

            <div

              key={e.path}

              className={`group relative flex w-full items-center gap-2 rounded-none pr-2 py-1 text-left text-[13px] leading-4 transition-all duration-150 ${rowCls}`}

              style={{ paddingLeft: indentPx }}

            >

              <span className="inline-block w-[18px] shrink-0" />

              <Icon className="h-[18px] w-[18px] shrink-0 text-muted" />

              <input

                className="min-w-0 flex-1 rounded border border-border bg-bg px-1 py-0.5 text-[13px] text-text outline-none focus-visible:border-accent"

                autoFocus

                value={props.inlineRenameValue}

                onChange={(ev) => props.onInlineRenameValue(ev.currentTarget.value)}

                onFocus={(ev) => {

                  const v = ev.currentTarget.value;

                  const dot = v.lastIndexOf(".");

                  if (dot > 0) {

                    ev.currentTarget.setSelectionRange(0, dot);

                  } else {

                    ev.currentTarget.select();

                  }

                }}

                onKeyDown={(ev) => {

                  if (ev.key === "Enter") {

                    ev.preventDefault();

                    props.onInlineRenameCommit();

                    return;

                  }

                  if (ev.key === "Escape") {

                    ev.preventDefault();

                    props.onInlineRenameCancel();

                    return;

                  }

                }}

                onBlur={() => props.onInlineRenameCommit()}

              />

            </div>

          );

        }

        return (

          <button

            key={e.path}

            type="button"

            className={`group relative flex w-full items-center gap-2 rounded-none pr-2 py-1 text-left text-[13px] leading-4 transition-all duration-150 ${rowCls}`}

            style={{ paddingLeft: indentPx }}

            onMouseEnter={(ev) => {

              if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);

              hoverTimerRef.current = window.setTimeout(() => {

                hoverTimerRef.current = null;

                if (!props.workspaceRoot) return;

                const root = props.workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");

                const rel = e.path.replace(/^\//, "");

                props.showTooltipForEl(ev.currentTarget, `${root}/${rel}`, "tl");

              }, 350);

            }}

            onMouseLeave={() => {

              if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);

              hoverTimerRef.current = null;

              props.hideTooltip();

            }}

            onMouseDown={() => {

              if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);

              hoverTimerRef.current = null;

              props.hideTooltip();

            }}

            onClick={() => {

              props.onSelect(e.path);

              props.onOpenFile(e.path);

            }}

            onContextMenu={(ev) => {

              ev.preventDefault();

              props.onSelect(e.path);

              props.onContextMenu({ x: ev.clientX, y: ev.clientY, path: e.path, isDir: false });

            }}

          >

            <span className="inline-block w-[18px] shrink-0" />

            <Icon className="h-[18px] w-[18px] shrink-0 text-muted group-hover:text-text" />

            <span className="relative top-[0.5px] truncate">{e.name}</span>

          </button>

        );

      })}

    </div>

  );

}



type ContextMenuItem =

  | { id: string; kind?: "normal" | "danger"; label: string; icon?: React.ReactNode; onClick: () => void }

  | { id: string; kind: "sep" };



function ContextMenu(props: {

  x: number;

  y: number;

  onClose: () => void;

  items: ContextMenuItem[];

}) {

  const rootRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: props.x, y: props.y });



  useEffect(() => {

    setPos({ x: props.x, y: props.y });

  }, [props.x, props.y, props.items.length]);



  useEffect(() => {

    const el = rootRef.current;

    if (!el) return;

    const raf = window.requestAnimationFrame(() => {

      const rect = el.getBoundingClientRect();

      const next = computeContextMenuPos({ x: props.x, y: props.y }, { w: rect.width, h: rect.height });

      if (next.x !== pos.x || next.y !== pos.y) {

        setPos(next);

      }

    });

    return () => window.cancelAnimationFrame(raf);

  }, [pos.x, pos.y, props.x, props.y, props.items.length]);



  return (

    <div className="fixed inset-0 z-50" onMouseDown={props.onClose}>

      <div

        className="absolute w-max min-w-64 max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-[#1A191C] bg-panel p-1 shadow-2xl"

        style={{ left: pos.x, top: pos.y }}

        onMouseDown={(e) => e.stopPropagation()}

        ref={rootRef}

      >

        {props.items.map((it) => {

          if ((it as any).kind === "sep") {

            return <div key={it.id} className="my-1 h-px bg-border/70" />;

          }

          const item = it as { id: string; kind?: "normal" | "danger"; label: string; icon?: React.ReactNode; onClick: () => void };

          const danger = item.kind === "danger";

          return (

            <button

              key={item.id}

              type="button"

              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] leading-4 ${

                danger

                  ? "text-red-300 hover:bg-bg hover:text-red-200"

                  : "text-text/90 hover:bg-bg hover:text-text"

              }`}

              onClick={() => {

                item.onClick();

                props.onClose();

              }}

            >

              <span className="flex min-w-0 items-center gap-2">

                {item.icon ? <span className={`shrink-0 ${danger ? "text-red-300" : "text-muted"}`}>{item.icon}</span> : null}

                <span className="truncate">{item.label}</span>

              </span>

            </button>

          );

        })}

      </div>

    </div>

  );

}



function TabButton(props: {

  tab: EditorTab;

  active: boolean;

  onActivate: () => void;

  onClose: () => void;

}) {

  const Icon = fileIconFor(props.tab.path);

  return (

    <div className="relative">

      <div

        className={`group relative flex h-8 max-w-[220px] items-center gap-2 rounded-md px-2 text-[13px] ${

          props.active ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"

        }`}

        onClick={props.onActivate}

        role="button"

        tabIndex={0}

        onKeyDown={(e) => {

          if (e.key === "Enter") props.onActivate();

        }}

      >

        <Icon className="h-4 w-4 shrink-0" />

        <span className="min-w-0 flex-1 truncate">{props.tab.name}</span>

        {props.tab.isDirty ? <span className="text-[10px] text-accent">●</span> : null}

        <button

          type="button"

          className="ml-1 rounded p-0.5 text-muted opacity-0 hover:bg-panel hover:text-text group-hover:opacity-100"

          onClick={(e) => {

            e.stopPropagation();

            props.onClose();

          }}

        >

          <X className="h-3.5 w-3.5" />

        </button>

      </div>

    </div>

  );

}



function WelcomeScreen(props: {

  recentWorkspaces: string[];

  recentFiles?: string[];

  onOpenFolder: () => void;

  onOpenFile?: () => void;

  onCreateNewFile?: () => void;

  onOpenRecentWorkspace: (p: string) => void;

  onOpenRecentFile?: (p: string) => void;

  onOpenChat?: () => void;

  onOpenCommandPalette?: () => void;

  shortcutOpenFolder?: string;

  shortcutOpenFile?: string;

  shortcutOpenChat?: string;

  shortcutOpenCommandPalette?: string;

  title?: string;

  subtitle?: string;

  hint?: string;

  compact?: boolean;

  useBrandFont?: boolean;

}) {

  const isCompact = !!props.compact;

  const useBrandFont = props.useBrandFont ?? true;



  const title = props.title ?? "POMPORA";

  const subtitle = props.subtitle ?? "Getting started with Pompora";

  const hint = props.hint ?? "Open a folder, then open a file to begin.";



  const recentFiles = (props.recentFiles ?? []).filter((x) => typeof x === "string");

  const recentWorkspaces = (props.recentWorkspaces ?? []).filter((x) => typeof x === "string");



  const renderFileLabel = (p: string): { name: string; detail: string } => {

    const norm = p.replace(/\\/g, "/");

    const name = basename(norm);

    return { name, detail: norm };

  };



  return (

    <div className="relative h-full w-full overflow-hidden">

      {!isCompact ? (

        <svg

          className="pointer-events-none absolute inset-0 h-full w-full"

          viewBox="0 0 1200 720"

          preserveAspectRatio="none"

          aria-hidden

        >

          <defs>

            <radialGradient id="pomporaDotsFade" cx="62%" cy="46%" r="78%">

              <stop offset="0%" stopColor="white" stopOpacity="1" />

              <stop offset="55%" stopColor="white" stopOpacity="0.35" />

              <stop offset="100%" stopColor="white" stopOpacity="0" />

            </radialGradient>



            <mask id="pomporaDotsMask">

              <rect width="1200" height="720" fill="url(#pomporaDotsFade)" />

            </mask>



            <pattern id="pomporaDots" width="180" height="180" patternUnits="userSpaceOnUse">

              <circle cx="24" cy="34" r="1.2" fill="rgb(var(--p-muted))" fillOpacity="0.22" />

              <circle cx="86" cy="62" r="1.6" fill="rgb(var(--p-muted))" fillOpacity="0.16" />

              <circle cx="148" cy="26" r="1" fill="rgb(var(--p-muted))" fillOpacity="0.14" />

              <circle cx="58" cy="134" r="1" fill="rgb(var(--p-muted))" fillOpacity="0.12" />

              <circle cx="132" cy="128" r="1.8" fill="rgb(var(--p-muted))" fillOpacity="0.18" />

              <circle cx="170" cy="164" r="1" fill="rgb(var(--p-muted))" fillOpacity="0.1" />



              <circle cx="40" cy="92" r="0.9" fill="rgb(var(--p-muted))" fillOpacity="0.1" />

              <circle cx="104" cy="156" r="0.9" fill="rgb(var(--p-muted))" fillOpacity="0.1" />

              <circle cx="164" cy="84" r="0.9" fill="rgb(var(--p-muted))" fillOpacity="0.1" />

            </pattern>

          </defs>



          <g mask="url(#pomporaDotsMask)">

            <rect width="1200" height="720" fill="url(#pomporaDots)" opacity="0.9" />

          </g>

        </svg>

      ) : null}



      <div className={`relative z-10 flex h-full w-full flex-col items-center justify-center`}>

        <div className={`w-full ${isCompact ? "px-2 py-2" : "px-6 py-6"}`}>

          <div className={`mx-auto w-full ${isCompact ? "max-w-none" : "max-w-[760px]"}`}>

            <div className="text-center">

              <div

                className={`${

                  isCompact

                    ? `${useBrandFont ? "ws-brand-title" : ""} text-2xl`.trim()

                    : `${useBrandFont ? "ws-brand-title" : ""} text-5xl md:text-6xl`.trim()

                } font-normal text-text`}

              >

                {title === "POMPORA" ? (

                  <img

                    src="/pompora_logo_transparent.png"

                    alt="Pompora"

                    className={`${isCompact ? "h-17 w-19" : "h-22 w-24"} mx-auto select-none`}

                    draggable={false}

                  />

                ) : (

                  title

                )}

              </div>

              <div className={`${isCompact ? "mt-1 text-[11px]" : "mt-2 text-sm"} text-muted`}>{subtitle}</div>

              <div className={`${isCompact ? "mt-1 text-[10px]" : "mt-1 text-xs"} text-muted`}>{hint}</div>

            </div>



            {isCompact ? (

              <div className="mt-4 flex flex-col items-center gap-2">

                <div className="flex w-full max-w-[260px] flex-col gap-2">

                  <button type="button" className="ws-welcome-row" onClick={props.onOpenFolder}>

                    <span className="truncate">Open Folder</span>

                    <span className="ws-kbd">{props.shortcutOpenFolder ?? "Ctrl+K Ctrl+O"}</span>

                  </button>

                  {props.onOpenFile ? (

                    <button type="button" className="ws-welcome-row" onClick={props.onOpenFile}>

                      <span className="truncate">Open File</span>

                      <span className="ws-kbd">{props.shortcutOpenFile ?? "Ctrl+O"}</span>

                    </button>

                  ) : null}

                </div>



                {props.onCreateNewFile ? (

                  <button

                    type="button"

                    className="mt-2 text-[12px] text-muted underline-offset-4 hover:underline hover:text-text"

                    onClick={props.onCreateNewFile}

                  >

                    Create a new file

                  </button>

                ) : null}

              </div>

            ) : null}



            {!isCompact ? (

            <div className={`${isCompact ? "mt-4" : "mt-7"} space-y-6`}>

              <section className="text-left">

                <div className="ws-welcome-section-title">Quick actions</div>

                <div className="mt-3 space-y-2">

                  <button

                    type="button"

                    className="ws-welcome-row"

                    onClick={() => props.onOpenChat?.()}

                    disabled={!props.onOpenChat}

                  >

                    <span className="truncate">Open Chat</span>

                    <span className="ws-kbd">{props.shortcutOpenChat ?? "Ctrl+L"}</span>

                  </button>

                  <button

                    type="button"

                    className="ws-welcome-row"

                    onClick={() => props.onOpenCommandPalette?.()}

                    disabled={!props.onOpenCommandPalette}

                  >

                    <span className="truncate">Open Command Palette</span>

                    <span className="ws-kbd">{props.shortcutOpenCommandPalette ?? "Ctrl+Shift+P"}</span>

                  </button>

                </div>

              </section>



              {recentWorkspaces.length > 0 || (recentFiles.length > 0 && !!props.onOpenRecentFile) ? (

                <section className="text-left">

                  <div className="ws-welcome-section-title">Recent</div>



                  {recentWorkspaces.length ? (

                    <div className="mt-3">

                      <div className="ws-welcome-subtitle">Workspaces</div>

                      <div className="mt-2 space-y-2">

                        {recentWorkspaces.slice(0, 1).map((p) => (

                          <button key={p} type="button" className="ws-welcome-row" onClick={() => props.onOpenRecentWorkspace(p)}>

                            <span className="truncate">{p}</span>

                            <span className="text-[11px] text-muted">Open</span>

                          </button>

                        ))}

                      </div>

                    </div>

                  ) : null}



                  {recentFiles.length && props.onOpenRecentFile ? (

                    <div className={`${recentWorkspaces.length ? "mt-6" : "mt-3"}`}>

                      <div className="ws-welcome-subtitle">Files</div>

                      <div className="mt-2 space-y-2">

                        {recentFiles.slice(0, 3).map((p) => {

                          const r = renderFileLabel(p);

                          const Icon = fileIconFor(p);

                          return (

                            <button key={p} type="button" className="ws-welcome-row" onClick={() => props.onOpenRecentFile?.(p)}>

                              <span className="flex min-w-0 flex-1 items-center gap-2 truncate">

                                <Icon className="h-4 w-4 shrink-0" />

                                <span className="min-w-0 flex-1 truncate">{r.name}</span>

                              </span>

                              <span className="ml-3 max-w-[56%] truncate text-[11px] text-muted">{r.detail}</span>

                            </button>

                          );

                        })}

                      </div>

                    </div>

                  ) : null}

                </section>

              ) : null}



            </div>

            ) : null}

          </div>

        </div>

      </div>

    </div>

  );

}



function CommandPalette(props: {

  query: string;

  setQuery: (v: string) => void;

  commands: Command[];

  index: number;

  setIndex: (v: number) => void;

  onClose: () => void;

  onRun: (cmd: Command) => void;

}) {

  const list = props.commands;



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === "ArrowDown") {

        e.preventDefault();

        props.setIndex(Math.min(props.index + 1, Math.max(0, list.length - 1)));

      }

      if (e.key === "ArrowUp") {

        e.preventDefault();

        props.setIndex(Math.max(0, props.index - 1));

      }

      if (e.key === "Enter") {

        e.preventDefault();

        const cmd = list[props.index];

        if (cmd) props.onRun(cmd);

      }

    };



    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [list, props]);



  return (

    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={props.onClose}>

      <div

        className="mx-auto mt-20 w-[820px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className="border-b border-border p-3">

          <input

            className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted"

            placeholder="Type a command"

            autoFocus

            value={props.query}

            onChange={(e) => props.setQuery(e.currentTarget.value)}

          />

        </div>

        <div className="max-h-[360px] overflow-auto p-2">

          {list.length ? (

            list.map((c, i) => (

              <button

                key={c.id}

                type="button"

                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${

                  i === props.index ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"

                }`}

                onMouseEnter={() => props.setIndex(i)}

                onClick={() => props.onRun(c)}

              >

                <span>{c.label}</span>

                <span className="text-xs text-muted">{c.shortcut ?? ""}</span>

              </button>

            ))

          ) : (

            <div className="p-3 text-sm text-muted">No commands</div>

          )}

        </div>

      </div>

    </div>

  );

}



interface SettingsScreenProps {

  settings: AppSettings;

  authProfile: AuthProfile | null;

  authCredits: CreditsResponse | null;

  isAuthBusy: boolean;

  providerLabel: string;

  keyStatus: KeyStatus | null;

  providerChoices: ReadonlyArray<{ id: string; label: string; api: boolean }>;

  apiKeyDraft: string;

  encryptionPasswordDraft: string;

  secretsError: string | null;

  isSavingSettings: boolean;

  isTogglingOffline: boolean;

  isKeyOperationInProgress: boolean;

  isSettingsLoaded: boolean;

  workspaceLabel: string;

  recentWorkspaces: string[];

  onChangeTheme: (t: Theme) => void;

  onChangeCursorBlinking: (v: CursorBlinking) => void;

  onChangeLineHighlightColor: (hex: string | null) => void;

  onChangeCursorColor: (hex: string | null) => void;

  onChangeKeybindings: (next: Record<string, string>) => void;

  onToggleOffline: () => void;

  onChangeProvider: (p: string | null) => void;

  onChangePomporaThinking: (t: string | null) => void;

  onPickFolder: () => void;

  onOpenRecent: (p: string) => void;

  onApiKeyDraft: (v: string) => void;

  onEncryptionPasswordDraft: (v: string) => void;

  onStoreKey: () => void;

  onClearKey: () => void;

  onLoginToPompora: () => void;

  onSignupToPompora: () => void;

  onSaveSettings: () => void;

  showKeySaved: boolean;

  showKeyCleared: boolean;

  onDebugGemini: () => void;

  debugResult: string | null;

  providerModels: Record<string, Array<{ id: string; name?: string | null }>>;

  loadingModels: Record<string, boolean>;

  providerModelsError: Record<string, string | null>;

  onLoadModels: (providerId: string) => void;

  onSelectModel: (providerId: string, modelId: string) => void;



  onClearChatHistory: () => void;

  onClearAllProviderKeys: () => void;

  onClearAuth: () => void;

  onClearSettingsFile: () => void;

  onWipeAll: () => void;

}



function __clampInt(n: number, min: number, max: number): number {

  if (!Number.isFinite(n)) return min;

  return Math.max(min, Math.min(max, Math.trunc(n)));

}



function __toHexByte(n: number): string {

  return __clampInt(n, 0, 255).toString(16).padStart(2, "0").toUpperCase();

}



function __parseHexColor(raw: string): { hex: string; r: number; g: number; b: number; a: number } | null {

  const s = String(raw || "").trim();

  const m = s.match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

  if (!m?.[1]) return null;

  const h = m[1].toUpperCase();

  const r = Number.parseInt(h.slice(0, 2), 16);

  const g = Number.parseInt(h.slice(2, 4), 16);

  const b = Number.parseInt(h.slice(4, 6), 16);

  const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) : 255;

  const hex = `#${h.length === 6 ? h : h}`;

  return { hex, r, g, b, a };

}



function __rgbaToHex(r: number, g: number, b: number, a?: number): string {

  const aa = a === undefined ? 255 : __clampInt(a, 0, 255);

  const base = `#${__toHexByte(r)}${__toHexByte(g)}${__toHexByte(b)}`;

  return aa === 255 ? base : `${base}${__toHexByte(aa)}`;

}



function __parseRgbLike(raw: string): { r: number; g: number; b: number; a?: number } | null {

  const s = String(raw || "").trim();

  if (!s) return null;

  const m = s.match(/^rgba?\(([^)]+)\)$/i);

  const inner = (m?.[1] ?? s).trim();

  const parts = inner

    .split(/[,\s]+/)

    .map((x) => x.trim())

    .filter(Boolean);

  if (parts.length < 3) return null;

  const r = Number(parts[0]);

  const g = Number(parts[1]);

  const b = Number(parts[2]);

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;

  if (parts.length >= 4) {

    const aRaw = parts[3] ?? "";

    const aNum = Number(aRaw);

    if (Number.isFinite(aNum)) {

      const a = aNum <= 1 ? __clampInt(aNum * 255, 0, 255) : __clampInt(aNum, 0, 255);

      return { r: __clampInt(r, 0, 255), g: __clampInt(g, 0, 255), b: __clampInt(b, 0, 255), a };

    }

  }

  return { r: __clampInt(r, 0, 255), g: __clampInt(g, 0, 255), b: __clampInt(b, 0, 255) };

}



function __rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {

  const rr = __clampInt(r, 0, 255) / 255;

  const gg = __clampInt(g, 0, 255) / 255;

  const bb = __clampInt(b, 0, 255) / 255;



  const max = Math.max(rr, gg, bb);

  const min = Math.min(rr, gg, bb);

  const d = max - min;



  let h = 0;

  if (d !== 0) {

    if (max === rr) h = ((gg - bb) / d) % 6;

    else if (max === gg) h = (bb - rr) / d + 2;

    else h = (rr - gg) / d + 4;

    h *= 60;

    if (h < 0) h += 360;

  }



  const s = max === 0 ? 0 : d / max;

  const v = max;

  return { h, s, v };

}



function __hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {

  const hh = ((Number.isFinite(h) ? h : 0) % 360 + 360) % 360;

  const ss = Math.max(0, Math.min(1, Number.isFinite(s) ? s : 0));

  const vv = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));



  const c = vv * ss;

  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));

  const m = vv - c;



  let r1 = 0;

  let g1 = 0;

  let b1 = 0;

  if (hh < 60) {

    r1 = c;

    g1 = x;

  } else if (hh < 120) {

    r1 = x;

    g1 = c;

  } else if (hh < 180) {

    g1 = c;

    b1 = x;

  } else if (hh < 240) {

    g1 = x;

    b1 = c;

  } else if (hh < 300) {

    r1 = x;

    b1 = c;

  } else {

    r1 = c;

    b1 = x;

  }



  return {

    r: __clampInt((r1 + m) * 255, 0, 255),

    g: __clampInt((g1 + m) * 255, 0, 255),

    b: __clampInt((b1 + m) * 255, 0, 255),

  };

}



class SettingsErrorBoundary extends Component<

  { children: React.ReactNode },

  { hasError: boolean; error: unknown }

> {

  constructor(props: { children: React.ReactNode }) {

    super(props);

    this.state = { hasError: false, error: null };

  }



  static getDerivedStateFromError(error: unknown) {

    return { hasError: true, error };

  }



  render() {

    if (this.state.hasError) {

      const msg = this.state.error instanceof Error ? this.state.error.message : String(this.state.error);

      return (

        <div className="p-6">

          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">

            Settings crashed: {msg}

          </div>

        </div>

      );

    }

    return this.props.children;

  }

}



const SettingsScreen: React.FC<SettingsScreenProps> = (props) => {

  const [query, setQuery] = useState("");



  const avatarLetter = useMemo(() => {

    const first = (props.authProfile?.first_name ?? "").trim();

    const last = (props.authProfile?.last_name ?? "").trim();

    if (first && last) return `${first[0]!.toUpperCase()}${last[0]!.toUpperCase()}`;

    if (first) return first[0]!.toUpperCase();

    const email = (props.authProfile?.email ?? "").trim();

    if (email) return email[0]!.toUpperCase();

    return "U";

  }, [props.authProfile?.email, props.authProfile?.first_name, props.authProfile?.last_name]);



  const [avatarImgError, setAvatarImgError] = useState(false);

  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);



  useEffect(() => {

    setAvatarImgError(false);

    setAvatarDataUrl(null);

  }, [props.authProfile?.avatar_url]);



  useEffect(() => {

    const url = (props.authProfile?.avatar_url ?? "").trim();

    if (!url) return;

    let cancelled = false;

    authAvatarDataUrl(url)

      .then((d: string) => {

        if (cancelled) return;

        const next = String(d || "").trim();

        if (next) setAvatarDataUrl(next);

      })

      .catch((e: unknown) => {

        if (cancelled) return;

        console.error("authAvatarDataUrl failed (settings)", e);

      });

    return () => {

      cancelled = true;

    };

  }, [props.authProfile?.avatar_url]);





  const ShortcutEditor = (p: {

    commandId: string;

    value: string;

    defaultValue: string;

  }) => {

    const [isCapturing, setIsCapturing] = useState(false);

    const [conflict, setConflict] = useState<string | null>(null);



    useEffect(() => {

      if (!isCapturing) return;

      (window as any).__pomporaCapturingShortcut = true;



      const onKeyDown = (e: KeyboardEvent) => {

        e.preventDefault();

        e.stopPropagation();



        if (e.key === "Escape") {

          setIsCapturing(false);

          return;

        }



        const raw = __eventToShortcut(e);

        if (!raw) return;

        const next = __normShortcut(raw);

        if (!next) return;



        const all = { ...DEFAULT_KEYBINDINGS, ...(props.settings.keybindings ?? {}) };

        const found = Object.entries(all).find(([id, v]) => id !== p.commandId && __normShortcut(v) === next);

        setConflict(found ? found[0] : null);



        props.onChangeKeybindings({

          ...(props.settings.keybindings ?? {}),

          [p.commandId]: next,

        });

        setIsCapturing(false);

      };



      window.addEventListener("keydown", onKeyDown, true);

      return () => {

        window.removeEventListener("keydown", onKeyDown, true);

        (window as any).__pomporaCapturingShortcut = false;

      };

    }, [isCapturing, p.commandId, props]);



    const remove = () => {

      const next = { ...(props.settings.keybindings ?? {}) };

      delete next[p.commandId];

      props.onChangeKeybindings(next);

      setConflict(null);

    };



    const reset = () => {

      props.onChangeKeybindings({

        ...(props.settings.keybindings ?? {}),

        [p.commandId]: __normShortcut(p.defaultValue),

      });

      setConflict(null);

    };



    return (

      <div className="w-full">

        <div className="flex w-full items-center justify-end gap-2">

          <button

            type="button"

            className={`min-w-[140px] rounded-lg border border-border bg-bg px-3 py-2 text-right font-mono text-xs text-text hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30 ${

              isCapturing ? "ring-2 ring-accent/40" : ""

            }`}

            data-shortcut-capturing={isCapturing ? "true" : "false"}

            onClick={() => {

              setConflict(null);

              setIsCapturing(true);

            }}

            aria-label="Capture shortcut"

          >

            {p.value ? __normShortcut(p.value) : "—"}

          </button>

          <button type="button" className="ws-icon-btn h-8 w-8" onClick={remove} aria-label="Remove shortcut">

            <Trash2 className="h-4 w-4" />

          </button>

          <button type="button" className="ws-icon-btn h-8 w-8" onClick={reset} aria-label="Reset shortcut">

            <RotateCw className="h-4 w-4" />

          </button>

        </div>

        {conflict ? (

          <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">

            Conflicts with: <span className="font-mono">{conflict}</span>

          </div>

        ) : null}

      </div>

    );

  };



  const ColorPicker = (p: {

    label: string;

    value: string | null | undefined;

    placeholder: string;

    defaultSwatch: string;

    onChange: (hex: string | null) => void;

  }) => {

    const [open, setOpen] = useState(false);

    const wrapRef = useRef<HTMLDivElement | null>(null);

    const triggerRef = useRef<HTMLButtonElement | null>(null);

    const popoverRef = useRef<HTMLDivElement | null>(null);

    const parsed = __parseHexColor(String(p.value ?? "").trim());

    const activeHex = parsed?.hex ?? null;

    const swatch = activeHex ? (activeHex.length === 9 ? activeHex.slice(0, 7) : activeHex) : p.defaultSwatch;



    const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);



    // Preview state for temporary changes while dragging

    const [previewHex, setPreviewHex] = useState<string>(String(p.value ?? "").trim());

    const [hexDraft, setHexDraft] = useState<string>(String(p.value ?? "").trim());

    const [rgbDraft, setRgbDraft] = useState<string>(() => {

      if (!parsed) return "";

      const { r, g, b, a } = parsed;

      return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;

    });



    const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() => {

      if (!parsed) return { h: 150, s: 0.56, v: 0.84 };

      return __rgbToHsv(parsed.r, parsed.g, parsed.b);

    });



    // Get current parsed color (from preview if open, otherwise from actual value)

    const currentParsed = __parseHexColor(open ? previewHex : String(p.value ?? "").trim());

    const currentHex = currentParsed?.hex ?? null;

    const currentSwatch = currentHex ? (currentHex.length === 9 ? currentHex.slice(0, 7) : currentHex) : p.defaultSwatch;

    const currentAlpha = currentParsed?.a ?? 255;



    useEffect(() => {

      const next = String(p.value ?? "").trim();

      setHexDraft(next);

      setPreviewHex(next);

      const px = __parseHexColor(next);

      if (!px) {

        setRgbDraft("");

        return;

      }

      const { r, g, b, a } = px;

      setRgbDraft(a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`);

      setHsv(__rgbToHsv(r, g, b));

    }, [p.value]);



    // Apply preview changes when closing (only if not cancelled)

    useEffect(() => {

      if (!open) {

        // Reset preview to current value when opening

        setPreviewHex(String(p.value ?? "").trim());

      }

    }, [open]);



    useEffect(() => {

      if (!open) return;

      const onDown = (e: MouseEvent) => {

        const t = e.target as Node | null;

        if (!t) return;

        if (wrapRef.current?.contains(t)) return;

        setOpen(false);

      };

      setTimeout(() => {

        window.addEventListener("mousedown", onDown);

      }, 0);

      return () => window.removeEventListener("mousedown", onDown);

    }, [open]);



    useEffect(() => {

      if (!open) return;

      let raf = 0;

      const place = () => {

        const trig = triggerRef.current;

        const pop = popoverRef.current;

        if (!trig || !pop) return;



        const t = trig.getBoundingClientRect();

        const pRect = pop.getBoundingClientRect();

        const vw = window.innerWidth;

        const vh = window.innerHeight;

        const pad = 10;



        const candidates = [

          { left: t.left, top: t.bottom + 8 },

          { left: t.right - pRect.width, top: t.bottom + 8 },

          { left: t.left, top: t.top - pRect.height - 8 },

          { left: t.right - pRect.width, top: t.top - pRect.height - 8 },

          { left: t.right + 8, top: t.top },

          { left: t.left - pRect.width - 8, top: t.top },

        ];



        const score = (pos: { left: number; top: number }) => {

          const cl = Math.max(pad, Math.min(vw - pad - pRect.width, pos.left));

          const ct = Math.max(pad, Math.min(vh - pad - pRect.height, pos.top));

          const visibleW = Math.max(0, Math.min(vw - pad, cl + pRect.width) - Math.max(pad, cl));

          const visibleH = Math.max(0, Math.min(vh - pad, ct + pRect.height) - Math.max(pad, ct));

          const area = visibleW * visibleH;

          const dy = Math.abs((ct + pRect.height / 2) - (t.top + t.height / 2));

          const dx = Math.abs((cl + pRect.width / 2) - (t.left + t.width / 2));

          return area - (dx + dy) * 0.1;

        };



        let best = candidates[0]!;

        let bestScore = score(best);

        for (const c of candidates.slice(1)) {

          const s = score(c);

          if (s > bestScore) {

            best = c;

            bestScore = s;

          }

        }



        const left = Math.max(pad, Math.min(vw - pad - pRect.width, best.left));

        const top = Math.max(pad, Math.min(vh - pad - pRect.height, best.top));

        setPopoverPos({ left, top });

      };



      raf = window.requestAnimationFrame(place);

      window.addEventListener("resize", place);

      window.addEventListener("scroll", place, true);

      return () => {

        window.cancelAnimationFrame(raf);

        window.removeEventListener("resize", place);

        window.removeEventListener("scroll", place, true);

      };

    }, [open]);



    const commitHex = useCallback(

      (raw: string) => {

        const px = __parseHexColor(raw);

        if (!px) return;

        setPreviewHex(px.hex);

        setHexDraft(px.hex);

        const { r, g, b, a } = px;

        setRgbDraft(a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`);

        setHsv(__rgbToHsv(r, g, b));

      },

      []

    );



    const commitRgb = useCallback(

      (raw: string) => {

        const pr = __parseRgbLike(raw);

        if (!pr) return;

        const hex = __rgbaToHex(pr.r, pr.g, pr.b, pr.a);

        setPreviewHex(hex);

        setHexDraft(hex);

        setRgbDraft(raw);

        setHsv(__rgbToHsv(pr.r, pr.g, pr.b));

      },

      []

    );



    const commitHsv = useCallback(

      (next: { h: number; s: number; v: number }) => {

        const rgb = __hsvToRgb(next.h, next.s, next.v);

        const hex = __rgbaToHex(rgb.r, rgb.g, rgb.b, currentAlpha);

        setPreviewHex(hex);

        setHexDraft(hex);

        const { r, g, b, a } = __parseHexColor(hex) || { r: 0, g: 0, b: 0, a: 255 };

        setRgbDraft(a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`);

      },

      [currentAlpha]

    );



    const svRef = useRef<HTMLDivElement | null>(null);

    const hueRef = useRef<HTMLInputElement | null>(null);



    const onPickSV = useCallback(

      (clientX: number, clientY: number) => {

        const el = svRef.current;

        if (!el) return;

        const r = el.getBoundingClientRect();

        const x = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));

        const y = Math.max(0, Math.min(1, (clientY - r.top) / Math.max(1, r.height)));

        const next = { ...hsv, s: x, v: 1 - y };

        setHsv(next);

        commitHsv(next);

      },

      [commitHsv, hsv]

    );



    const onSVPointerDown = useCallback(

      (e: React.PointerEvent) => {

        e.preventDefault();

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

        onPickSV(e.clientX, e.clientY);

      },

      [onPickSV]

    );



    const onSVPointerMove = useCallback(

      (e: React.PointerEvent) => {

        if (!(e.buttons & 1)) return;

        e.preventDefault();

        onPickSV(e.clientX, e.clientY);

      },

      [onPickSV]

    );



    return (

      <div ref={wrapRef} className="relative flex items-center justify-end gap-2">

        <button

          type="button"

          className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs text-muted hover:border-accent/60 hover:text-text"

          onClick={() => setOpen((v) => !v)}

          aria-expanded={open}

          ref={triggerRef}

        >

          <span className="h-4 w-4 rounded border border-border" style={{ background: swatch }} />

          <span className="max-w-[120px] truncate">{activeHex ?? "Default"}</span>

        </button>



        <button type="button" className="ws-vscode-btn" onClick={() => p.onChange(null)}>

          Reset

        </button>



        {open ? (

          <div

            ref={popoverRef}

            className="fixed z-50 w-[360px] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"

            style={{ left: popoverPos?.left ?? -9999, top: popoverPos?.top ?? -9999 }}

          >

            <div className="flex items-start justify-between gap-3 border-b border-border p-3">

              <div className="min-w-0">

                <div className="text-xs font-semibold text-text">{p.label}</div>

                <div className="mt-0.5 text-[11px] text-muted">Paste HEX or RGB(A). We’ll convert automatically.</div>

              </div>

              <button type="button" className="ws-icon-btn" onClick={() => setOpen(false)} aria-label="Close">

                <X className="h-4 w-4" />

              </button>

            </div>



            <div className="p-3">

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-3">

                  <div className="h-10 w-10 rounded-xl border border-border" style={{ background: currentSwatch }} />

                  <div className="min-w-0">

                    <div className="text-[11px] font-medium text-muted">Active</div>

                    <div className="truncate text-xs text-text">{currentHex ?? "Default"}</div>

                  </div>

                </div>

              </div>



              <div className="mt-3">

                <div

                  ref={svRef}

                  className="relative h-[180px] w-full overflow-hidden rounded-2xl border border-border"

                  style={{ background: `hsl(${Math.round(hsv.h)}, 100%, 50%)` }}

                  onPointerDown={onSVPointerDown}

                  onPointerMove={onSVPointerMove}

                >

                  <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #FFFFFF, rgba(255,255,255,0))" }} />

                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #000000, rgba(0,0,0,0))" }} />

                  <div

                    className="absolute h-4 w-4 -translate-x-2 -translate-y-2 rounded-full border border-white shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"

                    style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}

                  />

                </div>



                <div className="mt-3">

                  <div className="text-[11px] font-medium text-muted">Hue</div>

                  <input

                    ref={hueRef}

                    type="range"

                    min={0}

                    max={360}

                    value={Math.round(hsv.h)}

                    onChange={(e) => {

                      const h = Number(e.currentTarget.value);

                      const next = { ...hsv, h };

                      setHsv(next);

                      commitHsv(next);

                    }}

                    className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full"

                    style={{

                      background:

                        "linear-gradient(to right, #FF0000 0%, #FFFF00 16%, #00FF00 33%, #00FFFF 50%, #0000FF 66%, #FF00FF 83%, #FF0000 100%)",

                    }}

                  />

                </div>

              </div>



              <div className="mt-4 grid gap-2">

                <div>

                  <div className="text-[11px] font-medium text-muted">HEX</div>

                  <input

                    className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"

                    placeholder={p.placeholder}

                    value={hexDraft}

                    spellCheck={false}

                    onChange={(e) => setHexDraft(e.currentTarget.value)}

                    onBlur={() => commitHex(hexDraft)}

                    onKeyDown={(e) => {

                      if (e.key === "Enter") {

                        e.preventDefault();

                        commitHex(hexDraft);

                      }

                    }}

                  />

                </div>



                <div>

                  <div className="text-[11px] font-medium text-muted">RGB Values</div>

                  <div className="mt-1 grid grid-cols-3 gap-2">

                    <div>

                      <div className="text-[10px] text-muted mb-1">R</div>

                      <input

                        type="number"

                        min="0"

                        max="255"

                        className="w-full rounded-xl border border-border bg-bg px-2 py-1.5 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"

                        placeholder="0-255"

                        value={currentParsed?.r ?? ""}

                        spellCheck={false}

                        onChange={(e) => {

                          const val = parseInt(e.currentTarget.value) || 0;

                          const clamped = Math.max(0, Math.min(255, val));

                          const g = currentParsed?.g ?? 0;

                          const b = currentParsed?.b ?? 0;

                          const a = currentParsed?.a ?? 255;

                          const hex = __rgbaToHex(clamped, g, b, a);

                          setPreviewHex(hex);

                          setHexDraft(hex);

                          setRgbDraft(a === 255 ? `rgb(${clamped}, ${g}, ${b})` : `rgba(${clamped}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`);

                          setHsv(__rgbToHsv(clamped, g, b));

                        }}

                      />

                    </div>

                    <div>

                      <div className="text-[10px] text-muted mb-1">G</div>

                      <input

                        type="number"

                        min="0"

                        max="255"

                        className="w-full rounded-xl border border-border bg-bg px-2 py-1.5 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"

                        placeholder="0-255"

                        value={currentParsed?.g ?? ""}

                        spellCheck={false}

                        onChange={(e) => {

                          const val = parseInt(e.currentTarget.value) || 0;

                          const r = currentParsed?.r ?? 0;

                          const clamped = Math.max(0, Math.min(255, val));

                          const b = currentParsed?.b ?? 0;

                          const a = currentParsed?.a ?? 255;

                          const hex = __rgbaToHex(r, clamped, b, a);

                          setPreviewHex(hex);

                          setHexDraft(hex);

                          setRgbDraft(a === 255 ? `rgb(${r}, ${clamped}, ${b})` : `rgba(${r}, ${clamped}, ${b}, ${Math.round((a / 255) * 100) / 100})`);

                          setHsv(__rgbToHsv(r, clamped, b));

                        }}

                      />

                    </div>

                    <div>

                      <div className="text-[10px] text-muted mb-1">B</div>

                      <input

                        type="number"

                        min="0"

                        max="255"

                        className="w-full rounded-xl border border-border bg-bg px-2 py-1.5 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"

                        placeholder="0-255"

                        value={currentParsed?.b ?? ""}

                        spellCheck={false}

                        onChange={(e) => {

                          const val = parseInt(e.currentTarget.value) || 0;

                          const r = currentParsed?.r ?? 0;

                          const g = currentParsed?.g ?? 0;

                          const clamped = Math.max(0, Math.min(255, val));

                          const a = currentParsed?.a ?? 255;

                          const hex = __rgbaToHex(r, g, clamped, a);

                          setPreviewHex(hex);

                          setHexDraft(hex);

                          setRgbDraft(a === 255 ? `rgb(${r}, ${g}, ${clamped})` : `rgba(${r}, ${g}, ${clamped}, ${Math.round((a / 255) * 100) / 100})`);

                          setHsv(__rgbToHsv(r, g, clamped));

                        }}

                      />

                    </div>

                  </div>

                </div>



                <div>

                  <div className="text-[11px] font-medium text-muted">RGB / RGBA (legacy)</div>

                  <input

                    className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"

                    placeholder="rgb(96, 214, 170) or rgba(96, 214, 170, 0.8)"

                    value={rgbDraft}

                    spellCheck={false}

                    onChange={(e) => setRgbDraft(e.currentTarget.value)}

                    onBlur={() => commitRgb(rgbDraft)}

                    onKeyDown={(e) => {

                      if (e.key === "Enter") {

                        e.preventDefault();

                        commitRgb(rgbDraft);

                      }

                    }}

                  />

                </div>

              </div>



              <div className="mt-3 flex items-center justify-between">

                <div className="text-[11px] text-muted">Tip: alpha can be `#RRGGBBAA` or `rgba(..., 0.5)`</div>

                <button

                  type="button"

                  className="ws-btn h-8 border border-accent bg-accent px-3 text-xs text-white hover:opacity-90"

                  onClick={() => {

                    const px = __parseHexColor(previewHex);

                    if (px) {

                      p.onChange(px.hex);

                    }

                    setOpen(false);

                  }}

                >

                  Done

                </button>

              </div>

            </div>

          </div>

        ) : null}

      </div>

    );

  };



  const sectionList = useMemo(

    () =>

      [

        { id: "workspace", label: "Workspace" },

        { id: "appearance", label: "Appearance" },

        { id: "shortcuts", label: "Shortcuts" },

        { id: "ai", label: "AI" },

        { id: "privacy", label: "Privacy" },

      ] as const,

    []

  );



  type SectionId = (typeof sectionList)[number]["id"];

  const [activeSection, setActiveSection] = useState<SectionId>("workspace");



  useEffect(() => {

    const allowed = new Set(sectionList.map((s) => s.id));

    if (!allowed.has(activeSection)) setActiveSection("workspace");

  }, [activeSection, sectionList]);



  const sectionMeta = useMemo(() => {

    const map: Record<SectionId, { title: string; description: string }> = {

      workspace: { title: "Workspace", description: "Workspace folder and recent workspaces" },

      appearance: { title: "Appearance", description: "Theme" },

      shortcuts: { title: "Shortcuts", description: "Customize keyboard shortcuts" },

      ai: { title: "AI", description: "Providers & your account" },

      privacy: { title: "Privacy", description: "Manage and delete locally stored data" },

    };

    return map;

  }, []);



  type SettingItem = {

    id: string;

    section: SectionId;

    title: string;

    description: string;

    renderControl: () => ReactNode;

    keywords?: string;

  };



  const Dropdown = (p: {

    value: string;

    options: Array<{ value: string; label: string }>;

    onChange: (v: string) => void;

    widthClassName?: string;

  }) => {

    const [open, setOpen] = useState(false);

    const wrapRef = useRef<HTMLDivElement | null>(null);



    const active = p.options.find((o) => o.value === p.value) ?? p.options[0];



    useEffect(() => {

      const onDown = (e: MouseEvent) => {

        if (!open) return;

        const t = e.target as Node | null;

        if (!t) return;

        if (wrapRef.current?.contains(t)) return;

        setOpen(false);

      };

      window.addEventListener("mousedown", onDown);

      return () => window.removeEventListener("mousedown", onDown);

    }, [open]);



    if (!p.options.length) {

      return (

        <div ref={wrapRef} className={`relative ${p.widthClassName ?? ""}`.trim()}>

          <button type="button" className="ws-vscode-dropdown-btn opacity-60" disabled>

            <span className="truncate">No options</span>

          </button>

        </div>

      );

    }



    return (

      <div ref={wrapRef} className={`relative ${p.widthClassName ?? ""}`.trim()}>

        <button

          type="button"

          className="ws-vscode-dropdown-btn"

          onClick={() => setOpen((v) => !v)}

          aria-expanded={open}

        >

          <span className="truncate">{active?.label ?? ""}</span>

        </button>



        {open ? (

          <div className="ws-vscode-dropdown-menu">

            {p.options.map((o) => (

              <button

                key={o.value}

                type="button"

                className={`ws-vscode-dropdown-item ${o.value === p.value ? "ws-vscode-dropdown-item-active" : ""}`}

                onClick={() => {

                  p.onChange(o.value);

                  setOpen(false);

                }}

              >

                {o.label}

              </button>

            ))}

          </div>

        ) : null}

      </div>

    );

  };



  const settingsItems = useMemo<SettingItem[]>(

    () => {

      const shortcutDefs: Array<{ id: string; title: string; description: string; keywords: string }> = [

        { id: "chat.toggle", title: "Open/Close Chat", description: "Toggle chat dock", keywords: "shortcut chat" },

        { id: "view.commandPalette", title: "Open Command Palette", description: "Show the command palette", keywords: "shortcut command palette" },



        { id: "view.navigateBack", title: "Navigate Back", description: "Go back", keywords: "shortcut back navigate" },

        { id: "view.navigateForward", title: "Navigate Forward", description: "Go forward", keywords: "shortcut forward navigate" },



        { id: "file.newWindow", title: "New Window", description: "Open a new window", keywords: "shortcut new window" },

        { id: "file.openFile", title: "Open File", description: "Open a file", keywords: "shortcut open file" },

        { id: "file.openFolder", title: "Open Folder", description: "Open a folder", keywords: "shortcut open folder" },



        { id: "file.save", title: "Save", description: "Save current file", keywords: "shortcut save" },

        { id: "file.saveAs", title: "Save As", description: "Save current file as…", keywords: "shortcut save as" },

        { id: "file.saveAll", title: "Save All", description: "Save all open files", keywords: "shortcut save all" },



        { id: "file.close", title: "Close Editor", description: "Close the active editor", keywords: "shortcut close editor" },

        { id: "file.closeAll", title: "Close All Editors", description: "Close all editors", keywords: "shortcut close all" },

        { id: "window.close", title: "Close Window", description: "Close the application window", keywords: "shortcut close window" },
      ];

      const shortcutItems: SettingItem[] = shortcutDefs.map((d) => ({
        id: `shortcuts.${d.id}`,
        section: "shortcuts",
        title: d.title,
        description: d.description,
        keywords: d.keywords,
        renderControl: () => (
          <ShortcutEditor
            commandId={d.id}
            value={String(props.settings.keybindings?.[d.id] ?? DEFAULT_KEYBINDINGS[d.id] ?? "")}
            defaultValue={DEFAULT_KEYBINDINGS[d.id] ?? ""}
          />
        ),
      }));

      const baseItems: SettingItem[] = [
        {
          id: "workspace.folder",
          section: "workspace",
          title: "Workspace Folder",
          description: "Choose the folder you want to work in.",
          keywords: "workspace folder open",
          renderControl: () => (
            <button type="button" className="ws-vscode-btn" onClick={props.onPickFolder}>
              Open Folder
            </button>
          ),
        },
        {
          id: "editor.cursorBlinking",
          section: "appearance",
          title: "Cursor Blinking",
          description: "Control the cursor animation style.",
          keywords: "cursor caret blinking animation",
          renderControl: () => (
            <Dropdown
              value={props.settings.editor_cursor_blinking ?? "expand"}
              options={[
                { value: "blink", label: "Blink" },
                { value: "smooth", label: "Smooth" },
                { value: "phase", label: "Phase" },
                { value: "expand", label: "Expand" },
                { value: "solid", label: "Solid" },
              ]}
              onChange={(v) => props.onChangeCursorBlinking(v as CursorBlinking)}
            />
          ),
        },
        {
          id: "editor.lineHighlightColor",
          section: "appearance",
          title: "Line Highlight Color",
          description: "Customize the active line highlight in the editor.",
          keywords: "line highlight editor current line color",
          renderControl: () => (
            <ColorPicker
              label="Line highlight"
              value={props.settings.editor_line_highlight_color ?? null}
              placeholder="#232228"
              defaultSwatch="#232228"
              onChange={(hex) => props.onChangeLineHighlightColor(hex)}
            />
          ),
        },
        {
          id: "editor.cursorColor",
          section: "appearance",
          title: "Cursor Color",
          description: "Customize the editor caret (cursor) color.",
          keywords: "cursor caret color",
          renderControl: () => (
            <ColorPicker
              label="Cursor"
              value={props.settings.editor_cursor_color ?? null}
              placeholder="#60D6AA"
              defaultSwatch="#60D6AA"
              onChange={(hex) => props.onChangeCursorColor(hex)}
            />
          ),
        },
        {
          id: "appearance.theme",
          section: "appearance",
          title: "Theme",
          description: "Select a theme for the editor.",
          keywords: "theme editor",
          renderControl: () => (
            <Dropdown
              value={props.settings.theme ?? "vscode"}
              options={[
                { value: "vscode", label: "VS Code" },
                { value: "github", label: "GitHub" },
                { value: "monokai", label: "Monokai" },
              ]}
              onChange={(v) => props.onChangeTheme(v as Theme)}
            />
          ),
        },
        {
          id: "ai.provider",
          section: "ai",
          title: "AI Provider",
          description: "Select which AI provider to use.",
          keywords: "ai provider model",
          renderControl: () => (
            <Dropdown
              value={props.settings.active_provider ?? "openai"}
              options={[
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "google", label: "Google" },
                { value: "ollama", label: "Ollama" },
              ]}
              onChange={(v) => props.onChangeProvider(v)}
            />
          ),
        },
        {
          id: "ai.apiKey",
          section: "ai",
          title: "API Key",
          description: "Set your API key for the selected provider.",
          keywords: "api key secret",
          renderControl: () => (
            <input
              className="ws-vscode-input"
              type="password"
              placeholder="Enter API key"
              value={props.apiKeyDraft}
              onChange={(e) => props.onApiKeyDraft(e.target.value)}
            />
          ),
        },
        {
          id: "ai.model",
          section: "ai",
          title: "Active Model",
          description: "Select the active AI model.",
          keywords: "model selector",
          renderControl: () => (
            <Dropdown
              value={props.settings.active_model ?? ""}
              options={props.providerModels[props.settings.active_provider ?? "openai"]?.map((m) => ({ value: m.id, label: m.name ?? m.id })) ?? []}
              onChange={(v) => props.onSelectModel(props.settings.active_provider ?? "openai", v)}
            />
          ),
        },
        {
          id: "ai.encryption",
          section: "ai",
          title: "Encryption Password",
          description: "Optional extra protection for secrets storage.",
          keywords: "encryption password security",
          renderControl: () => (
            <input
              className="ws-vscode-input"
              placeholder="Optional encryption password"
              type={props.encryptionPasswordDraft ? "text" : "password"}
              value={props.encryptionPasswordDraft}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => props.onEncryptionPasswordDraft(e.target.value)}
            />
          ),
        },
      ];

      return baseItems.concat(shortcutItems);
    },
    [props]
  );

const filteredItems = useMemo(() => {
  if (!query) {
    return settingsItems.filter((x) => x.section === activeSection);
  }
  const qq = query.toLowerCase();
  return settingsItems.filter((x) => `${x.title} ${x.description} ${x.keywords ?? ""}`.toLowerCase().includes(qq));
}, [activeSection, query, settingsItems]);

const activeSectionTitle = useMemo(() => {
  if (query) return "Search Results";
  return sectionMeta[activeSection]?.title ?? "Settings";
}, [activeSection, query, sectionMeta]);

const activeSectionDesc = useMemo(() => {
  if (query) return `Found ${filteredItems.length} matching settings`;
  return sectionMeta[activeSection]?.description ?? "";
}, [activeSection, query, filteredItems.length, sectionMeta]);

return (
  <div className="flex h-full flex-col md:flex-row bg-bg text-text selection:bg-accent/30 overflow-hidden font-sans">
    {/* Sidebar */}
    <aside className="w-full md:w-[280px] flex flex-col border-b md:border-b-0 md:border-r border-border/40 bg-panel shrink-0 overflow-hidden">
      {/* User Profile */}
      <div className="p-5 flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-bg/40 border border-border/60 flex items-center justify-center text-sm font-medium text-muted shrink-0 shadow-inner overflow-hidden">
          {avatarLetter}
          {(avatarDataUrl || props.authProfile?.avatar_url) && !avatarImgError ? (
            <img
              src={avatarDataUrl || props.authProfile!.avatar_url}
              className="absolute inset-0 block h-full w-full object-cover"
              alt="Profile"
              onError={() => {
                console.error("settings avatar image failed to load", { url: avatarDataUrl || props.authProfile?.avatar_url });
                setAvatarImgError(true);
              }}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate leading-tight text-text/90">
            {props.authProfile?.email ?? "refionx@gmail.com"}
          </div>
          <div className="text-[11px] text-muted leading-tight mt-0.5 font-normal">
            {props.authCredits?.plan ?? props.authProfile?.plan ?? "Free Plan"}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/40 transition-colors group-focus-within:text-text" />
          <input
            className="w-full h-9 rounded-lg bg-bg border border-border/60 pl-9 pr-3 text-[12px] text-text outline-none transition-all placeholder:text-muted/60 focus:border-border focus:ring-1 focus:ring-border/20 shadow-sm"
            placeholder="Search settings"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border/20 mb-4">
          {[
            { id: "workspace", label: "Workspace", icon: SettingsIcon },
            { id: "appearance", label: "Appearance", icon: ArrowRight },
            { id: "shortcuts", label: "Shortcuts", icon: FileText },
            { id: "ai", label: "AI", icon: GitBranch },
            { id: "privacy", label: "Privacy", icon: Trash2 },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (document.activeElement && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onClick={() => { setActiveSection(item.id as any); setQuery(""); }}
                className={`ws-settings-section-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-transparent text-[13px] transition-[background-color,color] group active:scale-[0.98] focus:outline-none ${
                  isActive
                    ? "bg-panel2 text-text border-border/60"
                    : "text-muted/70 hover:bg-panel2 hover:text-text"
                }`}
              >
                <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-text" : "opacity-50 group-hover:opacity-100"}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
      </nav>
    </aside>

    {/* Main Content */}
    <main className="flex-1 overflow-y-auto bg-bg scroll-smooth">
      <div className="max-w-[800px] mx-auto py-10 px-4 md:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[15px] md:text-[18px] font-semibold text-text/90 tracking-tight">
              {activeSectionTitle}
            </h1>
            <p className="mt-1 text-[12px] md:text-[13px] text-muted font-normal">
              {activeSectionDesc}
            </p>
          </div>
        </div>

          {filteredItems.length > 0 && (
            <div className="bg-panel rounded-2xl border border-border/60 overflow-hidden shadow-2xl ring-1 ring-white/5">
              <div className="divide-y divide-border/10">
                {filteredItems.map((it) => (
                  <div
                    key={it.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 group hover:bg-panel2 transition-all duration-200"
                  >
                    <div className="min-w-0 max-w-xl">
                      <div className="text-[13.5px] font-semibold text-text/90 mb-1 group-hover:text-text transition-colors tracking-tight">{it.title}</div>
                      <div className="text-[11.5px] text-muted/70 leading-relaxed break-words font-medium">
                        {it.description}
                      </div>
                    </div>
                    <div className="shrink-0 flex justify-start md:justify-end min-w-0 md:min-w-[240px]">
                      {it.renderControl()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {query && filteredItems.length === 0 && (
            <div className="p-16 text-center">
              <Search className="h-10 w-10 text-muted/10 mx-auto mb-4" />
              <div className="text-muted text-[13px] font-normal">No settings found matching your search.</div>
            </div>
          )}

          {/* AI Section Footer Logic */}
          {activeSection === "ai" && !query && (
            <div className="mt-8 space-y-4">
              <div className="grid gap-4">
                {props.secretsError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[12px] animate-in fade-in slide-in-from-top-1">
                    {props.secretsError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="ws-vscode-btn px-4 h-9 rounded-xl text-[12px] font-medium bg-panel border-border/60 hover:bg-panel2 active:scale-95 transition-all shadow-sm"
                    onClick={props.onStoreKey}
                    disabled={!props.apiKeyDraft.trim() || props.isKeyOperationInProgress}
                  >
                    Save API Key
                  </button>
                  <button
                    type="button"
                    className="ws-vscode-btn px-4 h-9 rounded-xl text-[12px] font-medium bg-panel border-border/60 hover:bg-panel2 active:scale-95 transition-all shadow-sm"
                    onClick={props.onClearKey}
                    disabled={props.isKeyOperationInProgress}
                  >
                    Clear Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Section Logic */}
          {activeSection === "privacy" && !query && (
            <div className="mt-8 grid gap-3">
              <button
                onClick={props.onClearChatHistory}
                className="w-full flex items-center justify-between p-4 bg-panel rounded-xl border border-border/60 hover:bg-panel2 hover:border-border transition-all text-left shadow-sm group"
              >
                <span className="text-[13px] text-text/90 group-hover:text-text">Clear Chat History</span>
                <ChevronRight className="h-4 w-4 text-muted group-hover:text-text transition-all" />
              </button>

              <button
                onClick={props.onClearAllProviderKeys}
                className="w-full flex items-center justify-between p-4 bg-panel rounded-xl border border-border/60 hover:bg-panel2 hover:border-border transition-all text-left shadow-sm group"
              >
                <span className="text-[13px] text-text/90 group-hover:text-text">Clear All API Keys</span>
                <ChevronRight className="h-4 w-4 text-muted group-hover:text-text transition-all" />
              </button>

              <button
                onClick={props.onClearAuth}
                className="w-full flex items-center justify-between p-4 bg-panel rounded-xl border border-border/60 hover:bg-panel2 hover:border-border transition-all text-left shadow-sm group"
              >
                <span className="text-[13px] text-text/90 group-hover:text-text">Sign Out & Remove Account Data</span>
                <ChevronRight className="h-4 w-4 text-muted group-hover:text-text transition-all" />
              </button>

              <button
                onClick={props.onClearSettingsFile}
                className="w-full flex items-center justify-between p-4 bg-panel rounded-xl border border-border/60 hover:bg-panel2 hover:border-border transition-all text-left shadow-sm group"
              >
                <span className="text-[13px] text-text/90 group-hover:text-text">Reset Settings File</span>
                <ChevronRight className="h-4 w-4 text-muted group-hover:text-text transition-all" />
              </button>

              <button
                onClick={props.onWipeAll}
                className="w-full flex items-center justify-between p-4 bg-danger/10 rounded-xl border border-danger/30 hover:bg-danger/15 hover:border-danger/50 transition-all text-left shadow-sm group"
              >
                <span className="text-[13px] text-danger">Wipe All Local Data</span>
                <Trash2 className="h-4 w-4 text-danger/80 group-hover:text-danger transition-colors" />
              </button>
            </div>
          )}

          {/* Recent Workspaces Section */}
          {activeSection === "workspace" && !query && props.recentWorkspaces.length > 0 && (
            <div className="mt-12">
              <h3 className="text-[11px] font-semibold text-muted/80 mb-4 px-1 uppercase tracking-widest">Recent Workspaces</h3>
              <div className="grid gap-2">
                {props.recentWorkspaces.slice(0, 5).map((p) => (
                  <button
                    key={p}
                    onClick={() => props.onOpenRecent(p)}
                    className="flex items-center gap-3 p-4 bg-panel rounded-xl border border-border/60 hover:border-border hover:bg-panel2 transition-all text-left group overflow-hidden shadow-sm"
                  >
                    <Folder className="h-4 w-4 text-muted group-hover:text-text transition-colors shrink-0" />
                    <span className="text-[13px] text-muted group-hover:text-text truncate font-normal">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
