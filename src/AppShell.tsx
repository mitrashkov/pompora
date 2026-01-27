import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type { editor as MonacoEditorNS } from "monaco-editor";
import { listen } from "@tauri-apps/api/event";
import { Terminal as XTermTerminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Eye,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  ListChecks,
  Plus,
  TerminalSquare,
  RotateCw,
  Save,
  Search,
  Settings as SettingsIcon,
  Star,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  X,
  Palette,
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
  authGetCredits,
  debugGeminiEndToEnd,
  aiChat,
  settingsGet,
  settingsSet,
  workspaceGet,
  workspaceListDir,
  workspaceListFiles,
  workspaceReadFile,
  workspaceWriteFile,
  workspaceCreateDir,
  workspaceDelete,
  workspaceRename,
  workspaceSearch,
  workspacePickFile,
  workspacePickFolder,
  workspaceSet,
  terminalStart,
  terminalWrite,
  terminalResize,
  terminalKill,
} from "./lib/tauri";
import type { AiChatMessage, AiEditOp } from "./lib/tauri";
import type { AppSettings, AuthProfile, CreditsResponse, DirEntryInfo, EditorTab, KeyStatus, Theme, WorkspaceInfo } from "./lib/types";

type ActivityId = "explorer" | "search" | "scm";

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
  kind?: "run_request" | "activity" | "proposal" | "agent_run";
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
  proposal?: {
    changeSetId: string;
    title: string;
    plan: string[];
    risks: string[];
    files: Array<{ path: string; kind: "write" | "delete" | "rename"; isNew?: boolean }>;
    stats: { files: number; added: number; removed: number };
  };
  agentRun?: {
    phase: "think" | "plan" | "act" | "verify" | "done";
    status: "running" | "done" | "error";
    contextFiles: string[];
    thinkText: string;
    planItems: string[];
    verifyText: string;
    doneText: string;
    actions: Array<{ id: string; label: string; status: "pending" | "running" | "done" | "error" }>;
    output: string[];
    collapsed: { think: boolean; plan: boolean; act: boolean; output: boolean; verify: boolean; done: boolean };
  };
};

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

    // If text is streaming and only grows, keep the current cursor position.
    // Otherwise restart typing from the beginning.
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

function AgentRunCard({
  messageId,
  ar,
  onToggle,
}: {
  messageId: string;
  ar: NonNullable<ChatUiMessage["agentRun"]>;
  onToggle: (id: string, key: keyof NonNullable<ChatUiMessage["agentRun"]>["collapsed"]) => void;
}) {
  const phaseLabel =
    ar.phase === "think"
      ? "Think"
      : ar.phase === "plan"
        ? "Plan"
        : ar.phase === "act"
          ? "Act"
          : ar.phase === "verify"
            ? "Verify"
            : "Done";

  const phaseIcon =
    ar.phase === "think"
      ? Brain
      : ar.phase === "plan"
        ? ListChecks
        : ar.phase === "act"
          ? Wand2
          : ar.phase === "verify"
            ? Check
            : CheckCircle2;

  const PhaseIcon = phaseIcon;
  const thinkTyped = useTypewriterText(ar.thinkText || (ar.status === "running" ? "Thinking…" : ""), { enabled: true, cps: 75 });
  const verifyTyped = useTypewriterText(ar.verifyText || "", { enabled: true, cps: 85 });
  const doneTyped = useTypewriterText(ar.doneText || "", { enabled: true, cps: 90 });

  return (
    <div className="ws-msg ws-msg-anim ws-msg-assistant">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-muted">Agent</div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-text">
            <PhaseIcon className="h-4 w-4 text-muted" />
            <span className="truncate">Pompora</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-2">
            {ar.status === "running" ? (
              <CircleDashed className="h-4 w-4 text-muted animate-spin" />
            ) : ar.status === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-300" />
            )}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusPillClass(
                ar.status === "error" ? "error" : ar.status === "done" ? "done" : "running"
              )}`}
            >
              {phaseLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="ws-agent-panel">
          <button
            type="button"
            className="ws-agent-panel-h flex w-full items-center justify-between px-2 py-2 text-left"
            onClick={() => onToggle(messageId, "think")}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Brain className="h-4 w-4" />
              Thinking
            </span>
            <ChevronDown className={`h-4 w-4 text-muted ${ar.collapsed.think ? "" : "rotate-180"}`} />
          </button>
          <div className={`ws-agent-panel-b ${ar.collapsed.think ? "" : "ws-agent-panel-b-open"}`}>
            <div className="px-2 pb-2 text-[12px] text-muted whitespace-pre-wrap break-words">
              {thinkTyped}
              {ar.status === "running" ? <span className="ws-caret" /> : null}
            </div>
          </div>
        </div>

        <div className="ws-agent-panel">
          <button
            type="button"
            className="ws-agent-panel-h flex w-full items-center justify-between px-2 py-2 text-left"
            onClick={() => onToggle(messageId, "plan")}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <ListChecks className="h-4 w-4" />
              Plan
            </span>
            <ChevronDown className={`h-4 w-4 text-muted ${ar.collapsed.plan ? "" : "rotate-180"}`} />
          </button>
          <div className={`ws-agent-panel-b ${ar.collapsed.plan ? "" : "ws-agent-panel-b-open"}`}>
            <div className="px-2 pb-2">
              {(ar.planItems ?? []).length ? (
                <div className="space-y-1">
                  {(ar.planItems ?? []).slice(0, 12).map((p, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[12px] text-muted">
                      <span className="ws-log-dot mt-1" />
                      <span className="whitespace-pre-wrap break-words">{p}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-muted">No plan yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="ws-agent-panel">
          <button
            type="button"
            className="ws-agent-panel-h flex w-full items-center justify-between px-2 py-2 text-left"
            onClick={() => onToggle(messageId, "act")}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Wand2 className="h-4 w-4" />
              Actions
            </span>
            <ChevronDown className={`h-4 w-4 text-muted ${ar.collapsed.act ? "" : "rotate-180"}`} />
          </button>
          <div className={`ws-agent-panel-b ${ar.collapsed.act ? "" : "ws-agent-panel-b-open"}`}>
            <div className="px-2 pb-2">
              {(ar.actions ?? []).length ? (
                <div className="space-y-1">
                  {(ar.actions ?? []).slice(-14).map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-[12px] text-muted">
                      <span className="mt-0.5">
                        {a.status === "running" ? (
                          <CircleDashed className="h-4 w-4 animate-spin" />
                        ) : a.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        ) : a.status === "error" ? (
                          <AlertTriangle className="h-4 w-4 text-red-300" />
                        ) : (
                          <CircleDashed className="h-4 w-4" />
                        )}
                      </span>
                      <span className="whitespace-pre-wrap break-words">{a.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-muted">No actions yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="ws-agent-panel">
          <button
            type="button"
            className="ws-agent-panel-h flex w-full items-center justify-between px-2 py-2 text-left"
            onClick={() => onToggle(messageId, "output")}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <TerminalSquare className="h-4 w-4" />
              Output
            </span>
            <ChevronDown className={`h-4 w-4 text-muted ${ar.collapsed.output ? "" : "rotate-180"}`} />
          </button>
          <div className={`ws-agent-panel-b ${ar.collapsed.output ? "" : "ws-agent-panel-b-open"}`}>
            <div className="px-2 pb-2">
              {(ar.output ?? []).length ? (
                <div className="ws-terminal-log">
                  {(ar.output ?? []).slice(-120).map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap break-words">
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-muted">No output.</div>
              )}
            </div>
          </div>
        </div>

        <div className="ws-agent-panel">
          <button
            type="button"
            className="ws-agent-panel-h flex w-full items-center justify-between px-2 py-2 text-left"
            onClick={() => onToggle(messageId, "verify")}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Check className="h-4 w-4" />
              Verify
            </span>
            <ChevronDown className={`h-4 w-4 text-muted ${ar.collapsed.verify ? "" : "rotate-180"}`} />
          </button>
          <div className={`ws-agent-panel-b ${ar.collapsed.verify ? "" : "ws-agent-panel-b-open"}`}>
            <div className="px-2 pb-2 text-[12px] text-muted whitespace-pre-wrap break-words">
              {verifyTyped}
            </div>
          </div>
        </div>

        <div className="ws-agent-panel">
          <button
            type="button"
            className="ws-agent-panel-h flex w-full items-center justify-between px-2 py-2 text-left"
            onClick={() => onToggle(messageId, "done")}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <CheckCircle2 className="h-4 w-4" />
              Done
            </span>
            <ChevronDown className={`h-4 w-4 text-muted ${ar.collapsed.done ? "" : "rotate-180"}`} />
          </button>
          <div className={`ws-agent-panel-b ${ar.collapsed.done ? "" : "ws-agent-panel-b-open"}`}>
            <div className="px-2 pb-2 text-[12px] text-muted whitespace-pre-wrap break-words">
              {doneTyped}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function phaseRank(p: "think" | "plan" | "act" | "verify" | "done"): number {
  if (p === "think") return 0;
  if (p === "plan") return 1;
  if (p === "act") return 2;
  if (p === "verify") return 3;
  return 4;
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

function tryParseEditsFromAssistantOutput(
  raw: string
): { message: string; edits: AiEditOp[]; think?: string; plan?: string[]; verify?: string; done?: string } | null {
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
    };
    if (Array.isArray(obj.edits)) {
      const edits = obj.edits as AiEditOp[];
      const msg =
        (typeof obj.assistant_message === "string" ? obj.assistant_message : null) ??
        (typeof obj.summary === "string" ? obj.summary : null) ??
        "Proposed changes are ready.";

      const think = typeof obj.think === "string" ? obj.think : undefined;
      const verify = typeof obj.verify === "string" ? obj.verify : undefined;
      const done = typeof obj.done === "string" ? obj.done : undefined;

      let plan: string[] | undefined;
      if (Array.isArray(obj.plan)) {
        plan = (obj.plan as unknown[])
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean)
          .slice(0, 16);
      } else if (typeof obj.plan === "string") {
        plan = obj.plan
          .split("\n")
          .map((l) => l.replace(/^([-*]|\d+\.)\s+/, "").trim())
          .filter(Boolean)
          .slice(0, 16);
      }

      return { message: String(msg).trim(), edits, think, plan, verify, done };
    }
  }

  // If the full JSON object is malformed/truncated, try extracting just the edits array.
  const fallbackEdits = extractEditsArray(t);
  if (fallbackEdits && fallbackEdits.length) {
    return { message: "Proposed changes are ready.", edits: fallbackEdits };
  }

  return null;
}

function MenuSep() {
  return <div className="my-1 h-px bg-border" />;
}

function MenuCheck(props: { checked?: boolean }) {
  return props.checked ? <span className="text-[11px] text-muted">✓</span> : null;
}

function MenuItem(props: {
  label: string;
  shortcut?: string;
  right?: React.ReactNode;
  keepOpen?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
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
  if (ext === "html") return "html";
  if (ext === "md") return "markdown";
  if (ext === "rs") return "rust";
  if (ext === "toml") return "toml";
  if (ext === "yaml" || ext === "yml") return "yaml";
  return "plaintext";
}

function fileIconFor(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return FileJson;
  if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".js") || lower.endsWith(".jsx")) {
    return FileCode;
  }
  return FileText;
}

function statusPillClass(status: "pending" | "running" | "done" | "error"): string {
  if (status === "done") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (status === "error") return "bg-red-500/15 text-red-300 border-red-500/25";
  if (status === "running") return "bg-sky-500/15 text-sky-300 border-sky-500/25";
  return "bg-muted/10 text-muted border-border";
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
    pompora_thinking: null,
    workspace_root: null,
    recent_workspaces: [],
  });
  const settingsMutationSeqRef = useRef(0);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTogglingOffline, setIsTogglingOffline] = useState(false);

  const [workspace, setWorkspaceState] = useState<WorkspaceInfo>({ root: null, recent: [] });

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
  }, []);

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
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [untitledCounter, setUntitledCounter] = useState(1);
  const [explorer, setExplorer] = useState<Record<string, DirEntryInfo[]>>({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ path: string; line: number; text: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingReveal, setPendingReveal] = useState<{ path: string; line: number } | null>(null);

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
  const [chatHistoryQuery, setChatHistoryQuery] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const now = Date.now();
          const restored = parsed
            .filter((x: any) => x && typeof x.id === "string")
            .map((x: any) => ({
              id: String(x.id),
              title: typeof x.title === "string" ? x.title : "Chat",
              createdAt: typeof x.createdAt === "number" ? x.createdAt : now,
              updatedAt: typeof x.updatedAt === "number" ? x.updatedAt : now,
              messages: Array.isArray(x.messages) ? (x.messages as ChatUiMessage[]) : ([] as ChatUiMessage[]),
              logs: Array.isArray(x.logs) ? (x.logs as ChatLogEntry[]) : ([] as ChatLogEntry[]),
              draft: typeof x.draft === "string" ? x.draft : "",
              changeSet: (x.changeSet as ChangeSet | null) ?? null,
            }))
            .slice(0, 200);

          if (restored.length) return restored;
        }
      }
    } catch {
    }
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
  const [chatDockTab, setChatDockTab] = useState<"chat" | "logs">("chat");
  const [logGroupCollapsed, setLogGroupCollapsed] = useState<Record<string, boolean>>({});
  const SPLASH_SKIP_KEY = "pompora.splash_skip.v1";
  const [isSplashVisible, setIsSplashVisible] = useState(false);
  const [isSplashFading, setIsSplashFading] = useState(false);
  const [isSplashSkipMenuOpen, setIsSplashSkipMenuOpen] = useState(false);
  const [isSplashVideoReady, setIsSplashVideoReady] = useState(false);
  const [isSplashVideoError, setIsSplashVideoError] = useState(false);
  const [chatDockWidth, setChatDockWidth] = useState(340);
  const [explorerWidth, setExplorerWidth] = useState(300);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [panelTab, setPanelTab] = useState<"problems" | "output" | "debug" | "terminal" | "ports">("terminal");
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [uiPomporaThinking, setUiPomporaThinking] = useState<"slow" | "fast" | "reasoning" | null>(null);

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

  const hasChatHistory = useMemo(() => {
    return chatSessions.some((s) => s.messages.some((m) => m.role === "user"));
  }, [chatSessions]);

  const didBootstrapFreshChatRef = useRef(false);
  useEffect(() => {
    if (didBootstrapFreshChatRef.current) return;
    didBootstrapFreshChatRef.current = true;

    // Always start on a fresh empty chat on app launch.
    const now = Date.now();
    const id = `${now}-${Math.random().toString(16).slice(2)}`;
    setChatSessions((prev) => [...prev, { id, title: "Chat", createdAt: now, updatedAt: now, messages: [], logs: [], draft: "", changeSet: null }]);
    setActiveChatId(id);
  }, []);

  useEffect(() => {
    if (!chatSessions.length) return;
    if (chatSessions.some((s) => s.id === activeChatId)) return;
    setActiveChatId(chatSessions[0]!.id);
  }, [activeChatId, chatSessions]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatSessions));
      } catch {
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [chatSessions]);

  const splashHideTimerRef = useRef<number | null>(null);
  const splashVideoRef = useRef<HTMLVideoElement | null>(null);

  const hideSplash = useCallback(() => {
    setIsSplashFading(true);
    setIsSplashSkipMenuOpen(false);
    if (splashHideTimerRef.current) window.clearTimeout(splashHideTimerRef.current);
    splashHideTimerRef.current = window.setTimeout(() => {
      setIsSplashVisible(false);
      setIsSplashFading(false);
      splashHideTimerRef.current = null;
    }, 520);
  }, []);

  useEffect(() => {
    return () => {
      if (splashHideTimerRef.current) window.clearTimeout(splashHideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(SPLASH_SKIP_KEY) !== "1") {
        setIsSplashVisible(true);
      }
    } catch {
      setIsSplashVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!isSplashVisible) return;
    setIsSplashVideoReady(false);
    setIsSplashVideoError(false);

    const v = splashVideoRef.current;
    if (!v) return;

    try {
      v.load();
      const p = v.play();
      if (p && typeof (p as any).catch === "function") {
        (p as Promise<void>).catch(() => {
          setIsSplashVideoError(true);
        });
      }
    } catch {
      setIsSplashVideoError(true);
    }

    const probe = window.setTimeout(() => {
      try {
        const hasDecodedFrame = v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0;
        if (!hasDecodedFrame) setIsSplashVideoError(true);
      } catch {
        setIsSplashVideoError(true);
      }
    }, 1200);

    return () => window.clearTimeout(probe);
  }, [isSplashVisible]);

  useEffect(() => {
    if (!isSplashVisible) return;
    if (isSplashFading) return;
    const t = window.setTimeout(() => {
      hideSplash();
    }, 12000);
    return () => window.clearTimeout(t);
  }, [hideSplash, isSplashFading, isSplashVisible]);

  const skipSplashOneTime = useCallback(() => {
    hideSplash();
  }, [hideSplash]);

  const skipSplashAlways = useCallback(() => {
    try {
      localStorage.setItem(SPLASH_SKIP_KEY, "1");
    } catch {
    }
    hideSplash();
  }, [hideSplash]);

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
  const notifyRef = useRef<((n: Omit<AppNotification, "id">) => void) | null>(null);
  const sendChatRef = useRef<(() => Promise<void>) | null>(null);
  const refreshDirRef = useRef<((relDir?: string) => Promise<void>) | null>(null);
  const metaQueueRef = useRef<string[]>([]);
  const metaFlushTimerRef = useRef<number | null>(null);
  const lastQueuedMetaRef = useRef<string>("");
  const logStreamIdRef = useRef<Record<string, string>>({});

  const activeAgentRunIdRef = useRef<string | null>(null);

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

  const canShowChatLogs = Boolean(import.meta.env?.DEV);
  const devConsoleError = useCallback(
    (...args: any[]) => {
      if (!canShowChatLogs) return;
      console.error(...args);
    },
    [canShowChatLogs]
  );

  useEffect(() => {
    if (!canShowChatLogs && chatDockTab === "logs") setChatDockTab("chat");
  }, [canShowChatLogs, chatDockTab]);

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
      const groupId = input.groupId ?? activeAgentRunIdRef.current ?? "session";
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

  const toggleLogCollapsed = useCallback(
    (id: string) => {
      setActiveChatLogs((prev) => prev.map((l) => (l.id === id ? { ...l, collapsed: !l.collapsed } : l)));
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

      const groupId = activeAgentRunIdRef.current ?? "session";
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
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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
        const ok = window.confirm(`The app is about to run a potentially dangerous command:\n\n${c}\n\nRun anyway?`);
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
      const ok = window.confirm(
        `This change set is larger than usual or potentially destructive:\n\n- ${reasons.join("\n- ")}\n\nApply anyway?`
      );
      return ok;
    },
    []
  );

  const buildProposal = useCallback(
    (assistantText: string, cs: ChangeSet, didSanitize: boolean): ChatUiMessage["proposal"] => {
      const plan: string[] = [];
      const lines = String(assistantText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      let inPlan = false;
      for (const l of lines) {
        const lower = l.toLowerCase();
        if (lower === "plan:" || lower === "plan" || lower.startsWith("plan:")) {
          inPlan = true;
          continue;
        }
        if (inPlan) {
          if (lower.startsWith("notes") || lower.startsWith("result") || lower.startsWith("changes") || lower.startsWith("summary")) {
            inPlan = false;
            continue;
          }
          const item = l.replace(/^([-*]|\d+\.)\s+/, "").trim();
          if (item) plan.push(item);
          if (plan.length >= 6) break;
        }
      }

      const files = cs.files
        .map((f) => {
          if (f.kind === "rename") {
            const parts = f.path.split(" → ");
            return { path: parts[1] ?? f.path, kind: "rename" as const, isNew: false };
          }
          return { path: f.path, kind: f.kind, isNew: f.kind === "write" ? f.before === null : false };
        })
        .slice(0, 30);

      const risks: string[] = [];
      if (didSanitize) risks.push("AI returned paths outside this workspace; paths were sanitized.");
      const newFiles = cs.files.filter((f) => f.kind === "write" && f.before === null).length;
      const deletes = cs.files.filter((f) => f.kind === "delete").length;
      const renames = cs.files.filter((f) => f.kind === "rename").length;
      if (cs.files.length > 8) risks.push(`Large scope: ${cs.files.length} files.`);
      if (newFiles) risks.push(`Creates new files: ${newFiles}.`);
      if (deletes) risks.push(`Deletes files: ${deletes}.`);
      if (renames) risks.push(`Renames files: ${renames}.`);

      return {
        changeSetId: cs.id,
        title: "Proposed changes",
        plan: plan.length ? plan : ["Review proposed changes", "Apply when ready"],
        risks,
        files,
        stats: cs.stats,
      };
    },
    []
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
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number } | null>(null);
  const activeTab = useMemo(
    () => (activeTabPath ? tabs.find((t) => t.path === activeTabPath) ?? null : null),
    [activeTabPath, tabs]
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

  const newUntitledFile = useCallback(() => {
    const n = untitledCounter;
    setUntitledCounter((x) => x + 1);
    const path = `untitled:${Date.now()}:${n}`;
    const tab: EditorTab = {
      path,
      name: `Untitled-${n}`,
      language: "plaintext",
      content: "",
      isDirty: true,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabPath(path);
  }, [untitledCounter]);

  const openNewWindow = useCallback(() => {
    try {
      const label = `main-${Date.now()}`;
      // In dev, this will load the devUrl; in production it loads the bundled index.
      new WebviewWindow(label, { title: "Pompora", width: 1280, height: 800 });
    } catch (e) {
      devConsoleError("New window failed", e);
      window.alert(`Failed to open new window: ${String(e)}`);
    }
  }, [devConsoleError]);

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
      .catch(() => {
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
      .catch(() => {
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
          try {
            window.prompt("Open this URL in your browser:", target);
          } catch {
          }
          setIsAuthBusy(false);
          void authWaitLogin(state)
            .then(async (profile) => {
              setAuthProfile(profile);
              try {
                const credits = await authGetCredits();
                setAuthCredits(credits);
              } catch {
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
            } catch {
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

  // Additional effect to refresh key status when showKeySaved is true
  useEffect(() => {
    if (showKeySaved && settings.active_provider) {
      providerKeyStatus(settings.active_provider)
        .then((v) => {
          setKeyStatus(v);
        })
        .catch((e: unknown) => {
          setSecretsError(String(e));
        });
    }
  }, [showKeySaved, settings.active_provider]);

  const providerChoices = useMemo(
    () =>
      [
        { id: "pompora", label: "Pompora", api: false },
        { id: "openai", label: "GPT-4o mini", api: true },
        { id: "anthropic", label: "Claude 3.5 Sonnet", api: true },
        { id: "gemini", label: "Gemini Flash", api: true },
        { id: "deepseek", label: "DeepSeek Chat", api: true },
        { id: "groq", label: "Groq Llama", api: true },
        { id: "ollama", label: "Ollama", api: false },
        { id: "lmstudio", label: "LM Studio", api: false },
        { id: "custom", label: "Custom", api: true },
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
    return found?.label ?? p;
  }, [providerChoices, settings.active_provider, settings.pompora_thinking, uiPomporaThinking]);

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
      if (!authProfile) return "Log in to use Pompora AI";
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

  const showTooltipForEl = useCallback((el: HTMLElement, text: string, align: "tl" | "tr" = "tr") => {
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
      if (!t.closest("[data-model-picker-root]")) setIsModelPickerOpen(false);
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

  const workspacePathLabel = useMemo(() => {
    const root = workspace.root ?? settings.workspace_root;
    return root ?? "";
  }, [settings.workspace_root, workspace.root]);

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

  const addFolderToWorkspace = useCallback(async () => {
    const folder = await workspacePickFolder();
    if (!folder) return;
    // Multi-root workspaces are not implemented yet; mimic VS Code by switching to the picked folder.
    window.alert("Multi-root workspace is not implemented yet. Opening the selected folder instead.");
    const w = await workspaceSet(folder);
    setWorkspaceState(w);
    setSettingsState((s) => ({
      ...s,
      workspace_root: w.root,
      recent_workspaces: w.recent,
    }));
    setTabs([]);
    setActiveTabPath(null);
    await refreshRoot();
  }, [refreshRoot]);

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

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeChat.messages.length, chatBusy]);

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

  const startStreamingToMessageId = useCallback(
    (id: string, fullText: string) => {
      if (chatStreamTimerRef.current) window.clearInterval(chatStreamTimerRef.current);

      const parts = fullText.match(/\S+\s*/g) ?? [fullText];
      const step = fullText.length > 2400 ? 6 : fullText.length > 900 ? 4 : 2;
      const tick = fullText.length > 2400 ? 36 : 30;
      let i = 0;
      let last = "";

      chatStreamTimerRef.current = window.setInterval(() => {
        i = Math.min(parts.length, i + step);
        const nextText = parts.slice(0, i).join("");
        if (nextText !== last) {
          last = nextText;
          setActiveChatMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: nextText } : m)));
        }
        if (i >= parts.length) {
          if (chatStreamTimerRef.current) window.clearInterval(chatStreamTimerRef.current);
          chatStreamTimerRef.current = null;
        }
      }, tick);
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
        window.alert("No folder was selected.");
        return;
      }

      const w = await workspaceSet(folder);
      setWorkspaceState(w);
      setSettingsState((s) => ({
        ...s,
        workspace_root: w.root,
        recent_workspaces: w.recent,
      }));
      setTabs([]);
      setActiveTabPath(null);
      await refreshRoot();
    } catch (e) {
      devConsoleError("Open folder failed", e);
      window.alert(`Failed to open folder: ${String(e)}`);
    }
  }, [devConsoleError, refreshRoot]);

  const openRecent = useCallback(
    async (root: string) => {
      const w = await workspaceSet(root);
      setWorkspaceState(w);
      setSettingsState((s) => ({
        ...s,
        workspace_root: w.root,
        recent_workspaces: w.recent,
      }));
      setTabs([]);
      setActiveTabPath(null);
      await refreshRoot();
    },
    [refreshRoot]
  );

  const openFile = useCallback(
    async (relPath: string) => {
      const norm = normalizeRelPath(relPath);
      if (!norm) return;

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

  const changeWriteFiles = useMemo(() => {
    const cs = activeChat.changeSet;
    if (!cs) return [] as ChangeFile[];
    return cs.files.filter((f) => f.kind === "write" && typeof f.path === "string");
  }, [activeChat.changeSet]);

  const [selectedChangePath, setSelectedChangePath] = useState<string | null>(null);

  const [proposalPreviewOpen, setProposalPreviewOpen] = useState<Record<string, boolean>>({});

  const updateAgentRun = useCallback(
    (id: string, up: (prev: NonNullable<ChatUiMessage["agentRun"]>) => NonNullable<ChatUiMessage["agentRun"]>) => {
      setActiveChatMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id || m.kind !== "agent_run" || !m.agentRun) return m;
          return { ...m, agentRun: up(m.agentRun) };
        })
      );
    },
    [setActiveChatMessages]
  );

  const toggleAgentRunSection = useCallback(
    (id: string, key: keyof NonNullable<ChatUiMessage["agentRun"]>["collapsed"]) => {
      updateAgentRun(id, (ar) => ({ ...ar, collapsed: { ...ar.collapsed, [key]: !ar.collapsed[key] } }));
    },
    [updateAgentRun]
  );

  const [isChangeSummaryOpen, setIsChangeSummaryOpen] = useState(false);
  const lastChangeSetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = activeChat.changeSet?.id ?? null;
    if (id !== lastChangeSetIdRef.current) {
      lastChangeSetIdRef.current = id;
      setIsChangeSummaryOpen(false);
      setProposalPreviewOpen({});
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
        window.alert("No file was selected.");
        return;
      }

      // Ensure we have a workspace root that can read files via backend (backend only reads *relative* paths).
      const root = dirname(file);
      const w = await workspaceSet(root);
      setWorkspaceState(w);
      setSettingsState((s) => ({
        ...s,
        workspace_root: w.root,
        recent_workspaces: w.recent,
      }));

      setTabs([]);
      setActiveTabPath(null);
      await refreshRoot();

      // Since workspace root is the file's parent directory, rel path is just the basename.
      await openFile(basename(file));
      rememberRecentFile(file);
    } catch (e) {
      devConsoleError("Open file failed", e);
      window.alert(`Failed to open file: ${String(e)}`);
    }
  }, [devConsoleError, openFile, refreshRoot, rememberRecentFile]);

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
      setPendingReveal({ path: activeTab.path, line: Math.max(1, lineNumber) });
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

  const createNewFile = useCallback(async () => {
    if (!workspace.root) {
      await openFolder();
      return;
    }
    const base = baseDirForCreate(selectedPath);
    const name = window.prompt("New file name");
    if (!name) return;
    const rel = base ? `${base}/${name}` : name;
    await workspaceWriteFile(rel, "");
    await refreshDir(base || undefined);
    setSelectedPath(rel);
    await openFile(rel);
  }, [baseDirForCreate, openFile, openFolder, refreshDir, selectedPath, workspace.root]);

  const createNewFolder = useCallback(async () => {
    if (!workspace.root) {
      await openFolder();
      return;
    }
    const base = baseDirForCreate(selectedPath);
    const name = window.prompt("New folder name");
    if (!name) return;
    const rel = base ? `${base}/${name}` : name;
    await workspaceCreateDir(rel);
    await refreshDir(base || undefined);
    setSelectedPath(rel);
  }, [baseDirForCreate, openFolder, refreshDir, selectedPath, workspace.root]);

  const renameSelected = useCallback(async () => {
    if (!selectedPath) return;
    const currentName = basename(selectedPath);
    const nextName = window.prompt("Rename to", currentName);
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
  }, [refreshRoot, selectedPath]);

  const deleteSelected = useCallback(async () => {
    if (!selectedPath) return;
    const ok = window.confirm(`Delete '${basename(selectedPath)}'?`);
    if (!ok) return;
    const target = selectedPath;
    await workspaceDelete(target);

    setTabs((prev) =>
      prev.filter((t) => {
        if (t.path === target) return false;
        const prefix = target.endsWith("/") ? target : `${target}/`;
        return !t.path.startsWith(prefix);
      })
    );
    setActiveTabPath((prev) => {
      if (!prev) return prev;
      if (prev === target) return null;
      const prefix = target.endsWith("/") ? target : `${target}/`;
      if (prev.startsWith(prefix)) return null;
      return prev;
    });

    setSelectedPath(null);
    await refreshRoot();
  }, [refreshRoot, selectedPath]);

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
    (path: string) => {
      let nextActive: string | null = activeTabPath;
      setTabs((prev) => {
        const tab = prev.find((t) => t.path === path);
        if (tab?.isDirty) {
          const ok = window.confirm(`Close \'${tab.name}\' without saving?`);
          if (!ok) return prev;
        }
        const remaining = prev.filter((t) => t.path !== path);
        if (activeTabPath === path) {
          nextActive = remaining.length ? remaining[remaining.length - 1]!.path : null;
        }
        return remaining;
      });

      setActiveTabPath(nextActive);
    },
    [activeTabPath]
  );

  const saveActiveFile = useCallback(async () => {
    if (!activeTab) return;
    if (activeTab.path.startsWith("untitled:")) {
      if (!workspace.root) {
        await openFolder();
        if (!workspace.root) return;
      }
      const name = window.prompt("Save As (relative path)", activeTab.name);
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
  }, [activeTab, openFolder, refreshDir, workspace.root]);

  const saveAll = useCallback(async () => {
    const dirty = tabs.filter((t) => t.isDirty);
    for (const t of dirty) {
      if (t.path.startsWith("untitled:")) {
        setActiveTabPath(t.path);
        const name = window.prompt("Save As (relative path)", t.name);
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
  }, [tabs]);

  const saveAs = useCallback(async () => {
    if (!activeTab) return;
    if (!workspace.root) {
      await openFolder();
      if (!workspace.root) return;
    }
    const name = window.prompt("Save As (relative path)", activeTab.name);
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
  }, [activeTab, openFolder, refreshDir, workspace.root]);

  const revertFile = useCallback(async () => {
    if (!activeTab) return;
    if (activeTab.path.startsWith("untitled:")) {
      const ok = window.confirm("Revert will close this untitled file. Continue?");
      if (!ok) return;
      closeTab(activeTab.path);
      return;
    }
    const content = await workspaceReadFile(activeTab.path);
    setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, content, isDirty: false } : t)));
  }, [activeTab, closeTab]);

  const saveWorkspaceAs = useCallback(async () => {
    if (!workspace.root) {
      window.alert("No folder is open. Open a folder first.");
      return;
    }
    const name = window.prompt("Save Workspace As (file name)", "pompora-workspace.json");
    if (!name) return;
    const rel = name.trim().replace(/\\/g, "/");
    if (!rel) return;
    const payload = JSON.stringify({ folders: [workspace.root] }, null, 2);
    await workspaceWriteFile(rel, payload);
    await refreshDir(rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : undefined);
  }, [refreshDir, workspace.root]);

  const duplicateWorkspace = useCallback(async () => {
    if (!workspace.root) {
      window.alert("No folder is open. Open a folder first.");
      return;
    }
    const name = window.prompt("Duplicate Workspace As (file name)", "pompora-workspace-copy.json");
    if (!name) return;
    const rel = name.trim().replace(/\\/g, "/");
    if (!rel) return;
    const payload = JSON.stringify({ folders: [workspace.root] }, null, 2);
    await workspaceWriteFile(rel, payload);
    await refreshDir(rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : undefined);
  }, [refreshDir, workspace.root]);

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
      setTabs([]);
      setActiveTabPath(null);
      await refreshRoot();
      await openFile(basename(file));
      rememberRecentFile(file);
    },
    [openFile, refreshRoot, rememberRecentFile]
  );

  const closeFolder = useCallback(async () => {
    const ok = window.confirm("Close folder?");
    if (!ok) return;
    const w = await workspaceSet(null);
    setWorkspaceState(w);
    setSettingsState((s) => ({
      ...s,
      workspace_root: w.root,
      recent_workspaces: w.recent,
    }));
    setTabs([]);
    setActiveTabPath(null);
    setExplorer({});
    setExpandedDirs(new Set());
    setSelectedPath(null);
  }, []);

  const exitApp = useCallback(() => {
    try {
      void getCurrentWindow().close();
    } catch {
      window.close();
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setSettingsState((s) => {
      const next: AppSettings = { ...s, theme: s.theme === "dark" ? "light" : "dark" };
      void settingsSet(next).catch((e) => devConsoleError("Failed to save theme", e));
      return next;
    });
  }, [devConsoleError]);

  const changeProvider = useCallback(
    async (p: string | null) => {
      const seq = (settingsMutationSeqRef.current += 1);
      setKeyStatus(null);
      setShowKeySaved(false);
      setShowKeyCleared(false);

      const next = { ...settings, active_provider: p };
      setSettingsState(next);

      try {
        await settingsSet(next);
        if (p) {
          setKeyStatus(await providerKeyStatus(p));
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
    [devConsoleError, settings]
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
      setKeyStatus(await providerKeyStatus(settings.active_provider));
    } catch (e) {
      devConsoleError(e);
      setSecretsError(String(e));
    } finally {
      setIsKeyOperationInProgress(false);
    }
  }, [apiKeyDraft, devConsoleError, encryptionPasswordDraft, settings.active_provider]);

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
      const pw = window.prompt("Enter encryption password to use your stored provider key");
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

      const explicitRefs = workspace.root ? extractFileRefs(text) : [];
      const recentChangeFiles =
        workspace.root && activeChat.changeSet
          ? activeChat.changeSet.files
              .filter((f) => f.kind === "write" && typeof f.path === "string")
              .map((f) => f.path)
              .slice(0, 4)
          : [];
      const autoRefs = workspace.root && activeTab?.path ? [activeTab.path] : [];

      const referencedFiles =
        workspace.root
          ? Array.from(new Set([...explicitRefs, ...autoRefs, ...recentChangeFiles])).slice(0, 6)
          : [];
      agentRunId = `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      activeAgentRunIdRef.current = agentRunId;

      const agentRunMessage: ChatUiMessage = {
        id: agentRunId,
        role: "assistant",
        content: "",
        kind: "agent_run",
        agentRun: {
          phase: "think",
          status: "running",
          contextFiles: referencedFiles,
          thinkText: "",
          planItems: [],
          verifyText: "",
          doneText: "",
          actions: [],
          output: [],
          collapsed: { think: false, plan: false, act: false, output: true, verify: true, done: false },
        },
      };

      setActiveChatMessages([...base, agentRunMessage]);

      const fileContexts: Array<{ path: string; content: string; truncated: boolean }> = [];
      for (const p of referencedFiles) {
        const actionId = `read:${p}`;
        updateAgentRun(agentRunId, (ar) => ({
          ...ar,
          actions: ([...ar.actions, { id: actionId, label: `Read ${p}`, status: "running" as const }].slice(-40) as typeof ar.actions),
        }));
        try {
          const max = 12000;
          const pending =
            activeChat.changeSet?.files.find(
              (f) => f.kind === "write" && f.path === p && typeof f.after === "string"
            ) ?? null;

          const content = pending ? String(pending.after || "") : await workspaceReadFile(p);
          const truncated = content.length > max;
          fileContexts.push({ path: p, content: truncated ? content.slice(0, max) : content, truncated });
          updateAgentRun(agentRunId, (ar) => ({
            ...ar,
            actions: ar.actions.map((a) => (a.id === actionId ? { ...a, status: "done" } : a)),
          }));
        } catch {
          updateAgentRun(agentRunId, (ar) => ({
            ...ar,
            actions: ar.actions.map((a) => (a.id === actionId ? { ...a, status: "error" } : a)),
          }));
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

      const aiMessages: AiChatMessage[] = [
        {
          role: "system",
          content:
            "You are Pompora, an autonomous agentic coding system operating inside a real codebase. You MUST follow this workflow in order: THINK, PLAN, ACT, VERIFY, DONE. No skipping.\n\nOutput MUST be valid JSON only (no markdown), shaped as:\n{\n  \"assistant_message\": string,\n  \"think\": string,\n  \"plan\": string[],\n  \"verify\": string,\n  \"done\": string,\n  \"edits\": AiEditOp[]\n}\n\nRules:\n- Do not hallucinate files.\n- Prefer op='patch' with unified diff; keep patches minimal; do not replace whole files unless necessary.\n- Never patch lines that don't exist in the provided file context.\n- Use op='run' for commands; avoid destructive commands.\n- If you need more file context, return edits=[] and explain in assistant_message what file(s) to read.\n",
        },
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
            ] satisfies AiChatMessage[])
          : ([] as AiChatMessage[])),
        ...(recentMetaLines.length
          ? ([
              {
                role: "system" as const,
                content: "Recent IDE actions (already executed):\n" + recentMetaLines.map((l) => `- ${l}`).join("\n"),
              },
            ] satisfies AiChatMessage[])
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

      updateAgentRun(agentRunId, (ar) => ({
        ...ar,
        thinkText: String(parsedFromText?.think ?? "").trim(),
        planItems: Array.isArray(parsedFromText?.plan) ? parsedFromText!.plan!.slice(0, 16) : ar.planItems,
        verifyText: String(parsedFromText?.verify ?? "").trim(),
        doneText: String(parsedFromText?.done ?? "").trim(),
        phase: parsedFromText?.plan && parsedFromText.plan.length ? "plan" : "think",
      }));

      if (edits && edits.length) {
        setChatApplying(true);

        updateAgentRun(agentRunId, (ar) => ({ ...ar, phase: phaseRank(ar.phase) < phaseRank("act") ? "act" : ar.phase }));

        try {
          const norm = normalizeAiEdits(edits, workspace.root);
          const normalized = norm.edits;
          const changeSet = await buildChangeSet(normalized);
          setIsChatDockOpen(true);
          setActiveChatChangeSet(changeSet);

          const first = changeSet.files.find((f) => f.kind === "write" && typeof f.path === "string") as ChangeFile | undefined;
          if (first?.kind === "write") {
            setSelectedChangePath(first.path);
            await openFile(first.path);
          }

          const proposalId = `prop-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const proposal = buildProposal(assistantMsg, changeSet, norm.didSanitize);
          setActiveChatMessages((prev) => [
            ...prev,
            {
              id: proposalId,
              role: "assistant",
              content: "",
              kind: "proposal",
              proposal,
            },
          ]);
        } finally {
          setChatApplying(false);
        }
      } else {
        const safeMsg = assistantMsg.length
          ? looksLikeCodeDump(assistantMsg)
            ? "I’m ready—tell me what you want to change and I’ll guide you step by step."
            : assistantMsg
          : "Ready.";

        updateAgentRun(agentRunId, (ar) => ({
          ...ar,
          phase: "done",
          status: "done",
          doneText: ar.doneText || safeMsg,
        }));
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
        updateAgentRun(agentRunId, (ar) => ({
          ...ar,
          phase: "done",
          status: "error",
          doneText: ar.doneText || `${f.title}: ${f.message}`,
        }));
      }
    } finally {
      setChatBusy(false);
    }
  }, [
    activeChat.draft,
    activeChat.messages.length,
    activeChat.title,
    aiBlockedReason,
    authProfile,
    applyAiEditsNow,
    buildChangeSet,
    buildProposal,
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
    startStreamingToMessageId,
    workspace.root,
  ]);

  const settingsProviderChoices = useMemo(
    () => providerChoices.filter((p) => p.id !== "pompora"),
    [providerChoices]
  );

  useEffect(() => {
    sendChatRef.current = sendChat;
  }, [sendChat]);

  const commands = useMemo<Command[]>(() => {
    const c: Command[] = [
      { id: "file.openFolder", label: "File: Open Folder...", shortcut: "Ctrl+K Ctrl+O", run: () => void openFolder() },
      { id: "file.openFile", label: "File: Open File...", shortcut: "Ctrl+O", run: () => void openStandaloneFile() },
      { id: "file.quickOpen", label: "File: Quick Open...", shortcut: "Ctrl+P", run: () => void openQuickOpen() },
      { id: "editor.gotoLine", label: "Go: Go to Line...", shortcut: "Ctrl+G", run: () => openGoToLine() },
      { id: "file.newFile", label: "File: New File", shortcut: "Ctrl+N", run: () => newUntitledFile() },
      { id: "file.newFolder", label: "File: New Folder...", run: () => void createNewFolder() },
      { id: "file.rename", label: "File: Rename...", run: () => void renameSelected() },
      { id: "file.delete", label: "File: Delete", run: () => void deleteSelected() },
      { id: "file.save", label: "File: Save", shortcut: "Ctrl+S", run: () => void saveActiveFile() },
      { id: "file.saveAll", label: "File: Save All", shortcut: "Ctrl+K S", run: () => void saveAll() },
      { id: "view.commandPalette", label: "View: Show Command Palette", shortcut: "Ctrl+Shift+P", run: () => setIsPaletteOpen(true) },
      { id: "workbench.findInFiles", label: "Search: Find in Files", shortcut: "Ctrl+Shift+F", run: () => setActivity("search") },
      { id: "view.toggleTheme", label: "Preferences: Toggle Theme", run: () => toggleTheme() },
      { id: "view.settings", label: "Preferences: Open Settings", shortcut: "Ctrl+,", run: () => openSettingsTab() },
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
  }, [activeTab, closeTab, createNewFolder, deleteSelected, newUntitledFile, openFolder, openGoToLine, openQuickOpen, renameSelected, saveActiveFile, saveAll]);

  const filteredCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((x) => x.label.toLowerCase().includes(q));
  }, [commands, paletteQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setIsChatDockOpen((v) => !v);
        return;
      }

      if (e.ctrlKey && (e.key === "`" || e.code === "Backquote")) {
        e.preventDefault();
        toggleTerminal();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsPaletteOpen(true);
        return;
      }

      if (e.ctrlKey && e.key === "F4") {
        if (activeTab) {
          e.preventDefault();
          closeTab(activeTab.path);
        }
        return;
      }

      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "f") {
        const ed = editorRef.current;
        if (ed) {
          e.preventDefault();
          void ed.getAction("actions.find")?.run();
        }
        return;
      }

      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void openQuickOpen();
        return;
      }

      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        openGoToLine();
        return;
      }

      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "h") {
        const ed = editorRef.current;
        if (ed) {
          e.preventDefault();
          void ed.getAction("editor.action.startFindReplaceAction")?.run();
        }
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActivity("search");
        return;
      }

      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        openSettingsTab();
        return;
      }

      // chord handling (Ctrl+K ...)
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        (window as any).__pomporaChord = { started: Date.now() };
        return;
      }

      const chord = (window as any).__pomporaChord as { started: number } | undefined;
      if (chord && Date.now() - chord.started < 1500) {
        // Ctrl+K Ctrl+O
        if (e.ctrlKey && e.key.toLowerCase() === "o") {
          e.preventDefault();
          (window as any).__pomporaChord = null;
          void openFolder();
          return;
        }
        // Ctrl+K S
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          (window as any).__pomporaChord = null;
          void saveAll();
          return;
        }
      }
      if ((window as any).__pomporaChord) (window as any).__pomporaChord = null;

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveAs();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveActiveFile();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNewWindow();
        return;
      }

      if (e.ctrlKey && e.altKey && e.metaKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newUntitledFile();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newUntitledFile();
        return;
      }

      if (e.ctrlKey && e.key === "w") {
        if (activeTab) {
          e.preventDefault();
          closeTab(activeTab.path);
        }
        return;
      }

      if (e.key === "Escape") {
        setIsPaletteOpen(false);
        setIsQuickOpenOpen(false);
        setIsGoToLineOpen(false);
        setExplorerMenu(null);
        setIsFileMenuOpen(false);
        setIsFileMenuRecentOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, closeFolder, closeTab, newUntitledFile, openFolder, openGoToLine, openNewWindow, openQuickOpen, openStandaloneFile, saveActiveFile, saveAll, saveAs, toggleTerminal]);

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
      window.prompt("Copy to clipboard:", text);
    }
  }, []);

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
    setPaletteIndex(0);
  }, [paletteQuery]);

  const themeName = settings.theme === "light" ? "vs" : "vs-dark";

  return (
    <div className="h-full w-full bg-bg text-text">
      {isSplashVisible ? (
        <div
          className={`fixed inset-0 z-[100] bg-black transition-opacity duration-500 ${
            isSplashFading ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onMouseDown={() => setIsSplashSkipMenuOpen(false)}
        >
          <video
            className="h-full w-full object-cover"
            ref={splashVideoRef}
            autoPlay
            muted
            playsInline
            preload="auto"
            poster="/logo_transparent_bigger.png"
            onLoadedData={() => setIsSplashVideoReady(true)}
            onCanPlay={() => setIsSplashVideoReady(true)}
            onError={() => setIsSplashVideoError(true)}
            onEnded={() => {
              hideSplash();
            }}
          >
            <source src="/loading-screen.mp4" type="video/mp4" />
            <source src="/loading_screen.mp4" type="video/mp4" />
          </video>

          {!isSplashVideoReady && !isSplashVideoError ? (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-4">
              <div className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 backdrop-blur">
                Loading…
              </div>
            </div>
          ) : null}

          {isSplashVideoError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-[520px] rounded-xl border border-white/10 bg-black/50 p-5 text-center text-white backdrop-blur">
                <div className="text-sm font-medium">Your system can’t play this video format.</div>
                <div className="mt-1 text-[12px] text-white/70">
                  Re-encode to H.264/AAC (MP4) for best compatibility.
                </div>
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-4 right-4" onMouseDown={(e) => e.stopPropagation()}>
            <div className="relative">
              <div className="inline-flex overflow-hidden rounded-md border border-white/10 bg-black/40 text-[12px] text-white backdrop-blur">
                <button
                  type="button"
                  className="px-4 py-1.5 hover:bg-black/55"
                  onClick={skipSplashOneTime}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="flex items-center px-2 py-1.5 hover:bg-black/55"
                  onClick={() => setIsSplashSkipMenuOpen((v) => !v)}
                  aria-label="Skip options"
                >
                  <span className="mx-1 h-4 w-px bg-white/10" />
                  <ChevronDown className={`h-4 w-4 transition-transform ${isSplashSkipMenuOpen ? "rotate-180" : ""}`} />
                </button>
              </div>

              {isSplashSkipMenuOpen ? (
                <div className="absolute bottom-full right-0 mb-2 w-44 overflow-auto rounded-lg border border-white/10 bg-black/70 text-[12px] text-white shadow-xl backdrop-blur max-h-[320px]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/10"
                    onClick={skipSplashOneTime}
                  >
                    Skip one time
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/10"
                    onClick={skipSplashAlways}
                  >
                    Always skip
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid h-full grid-rows-[36px_1fr_26px]">
        <header className="border-b border-border bg-panel">
          <div className="grid h-9 grid-cols-[1fr_auto_1fr] items-center px-2" data-menubar-root>
            <div className="flex min-w-0 items-center gap-2 justify-self-start">
              <img src="/logo.png" alt="Pompora" className="h-5 w-5 shrink-0" />

              <div className="flex items-center gap-1 text-xs text-muted">
                <div className="relative">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 hover:bg-bg"
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
                    <div className="absolute left-0 top-full z-50 mt-1 w-max min-w-64 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                      <MenuItem label="New Text File" shortcut="Ctrl+N" onClick={() => newUntitledFile()} />
                      <MenuItem label="New File" shortcut="Ctrl+Alt+Win+N" onClick={() => newUntitledFile()} />
                      <MenuItem label="New Window" shortcut="Ctrl+Shift+N" onClick={() => openNewWindow()} />
                      <MenuSep />
                      <MenuItem label="Open File" shortcut="Ctrl+O" onClick={() => void openStandaloneFile()} />
                      <MenuItem label="Open Folder" shortcut="Ctrl+K Ctrl+O" onClick={() => void openFolder()} />
                      <div className="relative">
                        <MenuItem
                          label="Open Recent"
                          right={<ChevronRight className="h-3.5 w-3.5" />}
                          keepOpen
                          onMouseEnter={() => setIsFileMenuRecentOpen(true)}
                          onMouseLeave={() => setIsFileMenuRecentOpen(false)}
                          onClick={() => setIsFileMenuRecentOpen((v) => !v)}
                        />
                        {isFileMenuRecentOpen ? (
                          <div
                            className="absolute left-full top-0 z-50 ml-1 w-max min-w-72 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]"
                            onMouseEnter={() => setIsFileMenuRecentOpen(true)}
                            onMouseLeave={() => setIsFileMenuRecentOpen(false)}
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
                              recentFiles.map((p) => <MenuItem key={p} label={p} onClick={() => void openRecentFile(p)} />)
                            ) : (
                              <div className="px-2 py-1 text-xs text-muted">No recent files</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <MenuSep />
                      <MenuItem label="Add Folder to Workspace" onClick={() => void addFolderToWorkspace()} />
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
                        shortcut="Ctrl+F4"
                        onClick={() => (activeTab ? closeTab(activeTab.path) : undefined)}
                      />
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
                    className="rounded-md px-2 py-1 hover:bg-bg"
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
                    <div className="absolute left-0 top-full z-50 mt-1 w-max min-w-72 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                      <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={() => notify({ kind: "info", title: "Undo", message: "Coming next." })} />
                      <MenuItem label="Redo" shortcut="Ctrl+Y" onClick={() => notify({ kind: "info", title: "Redo", message: "Coming next." })} />
                      <MenuSep />
                      <MenuItem label="Cut" shortcut="Ctrl+X" onClick={() => notify({ kind: "info", title: "Cut", message: "Coming next." })} />
                      <MenuItem label="Copy" shortcut="Ctrl+C" onClick={() => notify({ kind: "info", title: "Copy", message: "Coming next." })} />
                      <MenuItem label="Paste" shortcut="Ctrl+V" onClick={() => notify({ kind: "info", title: "Paste", message: "Coming next." })} />
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
                        onClick={() => notify({ kind: "info", title: "Replace in Files", message: "Coming next." })}
                      />
                      <MenuSep />
                      <MenuItem label="Toggle Line Comment" shortcut="Ctrl+/" onClick={() => notify({ kind: "info", title: "Toggle Line Comment", message: "Coming next." })} />
                      <MenuItem
                        label="Toggle Block Comment"
                        shortcut="Shift+Alt+A"
                        onClick={() => notify({ kind: "info", title: "Toggle Block Comment", message: "Coming next." })}
                      />
                      <MenuItem
                        label="Emmet: Expand Abbreviation"
                        shortcut="Tab"
                        onClick={() => notify({ kind: "info", title: "Emmet", message: "Coming next." })}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 hover:bg-bg"
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
                    <div className="absolute left-0 top-full z-50 mt-1 w-max min-w-80 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
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
                    className="rounded-md px-2 py-1 hover:bg-bg"
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
                      className="absolute left-0 top-full z-50 mt-1 w-max min-w-80 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]"
                      onMouseLeave={() => {
                        setViewMenuSub(null);
                        setViewAppearanceSub(null);
                      }}
                    >
                      <MenuItem label="Command Palette…" shortcut="Ctrl+Shift+P" onClick={() => setIsPaletteOpen(true)} />
                      <MenuItem label="Open View…" onClick={() => notify({ kind: "info", title: "Open View", message: "Coming next." })} />
                      <MenuSep />

                      <div className="relative">
                        <MenuItem
                          label="Appearance"
                          right={<ChevronRight className="h-3.5 w-3.5" />}
                          keepOpen
                          onMouseEnter={() => setViewMenuSub("appearance")}
                          onClick={() => setViewMenuSub((v) => (v === "appearance" ? null : "appearance"))}
                        />
                        {viewMenuSub === "appearance" ? (
                          <div className="absolute left-full top-0 z-50 ml-1 w-max min-w-80 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
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
                                onMouseEnter={() => setViewAppearanceSub("activityBarPosition")}
                                onClick={() => setViewAppearanceSub((v) => (v === "activityBarPosition" ? null : "activityBarPosition"))}
                              />
                              {viewAppearanceSub === "activityBarPosition" ? (
                                <div className="absolute right-full top-0 z-50 mr-1 w-max min-w-56 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                                  <MenuItem label="Default" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />
                                  <MenuItem label="Top" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />
                                  <MenuItem label="Bottom" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />
                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Activity Bar", message: "Coming next." })} />
                                </div>
                              ) : null}
                            </div>

                            <div className="relative">
                              <MenuItem
                                label="Secondary Activity Bar Position"
                                right={<ChevronRight className="h-3.5 w-3.5" />}
                                keepOpen
                                onMouseEnter={() => setViewAppearanceSub("secondaryActivityBarPosition")}
                                onClick={() => setViewAppearanceSub((v) => (v === "secondaryActivityBarPosition" ? null : "secondaryActivityBarPosition"))}
                              />
                              {viewAppearanceSub === "secondaryActivityBarPosition" ? (
                                <div className="absolute right-full top-0 z-50 mr-1 w-max min-w-56 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                                  <MenuItem label="Default" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />
                                  <MenuItem label="Top" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />
                                  <MenuItem label="Bottom" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />
                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Secondary Activity Bar", message: "Coming next." })} />
                                </div>
                              ) : null}
                            </div>

                            <div className="relative">
                              <MenuItem
                                label="Panel Position"
                                right={<ChevronRight className="h-3.5 w-3.5" />}
                                keepOpen
                                onMouseEnter={() => setViewAppearanceSub("panelPosition")}
                                onClick={() => setViewAppearanceSub((v) => (v === "panelPosition" ? null : "panelPosition"))}
                              />
                              {viewAppearanceSub === "panelPosition" ? (
                                <div className="absolute right-full top-0 z-50 mr-1 w-max min-w-56 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                                  <MenuItem label="Top" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />
                                  <MenuItem label="Left" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />
                                  <MenuItem label="Right" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />
                                  <MenuItem label="Bottom" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Panel Position", message: "Coming next." })} />
                                </div>
                              ) : null}
                            </div>

                            <div className="relative">
                              <MenuItem
                                label="Align Panel"
                                right={<ChevronRight className="h-3.5 w-3.5" />}
                                keepOpen
                                onMouseEnter={() => setViewAppearanceSub("alignPanel")}
                                onClick={() => setViewAppearanceSub((v) => (v === "alignPanel" ? null : "alignPanel"))}
                              />
                              {viewAppearanceSub === "alignPanel" ? (
                                <div className="absolute right-full top-0 z-50 mr-1 w-max min-w-56 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                                  <MenuItem label="Center" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />
                                  <MenuItem label="Justify" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />
                                  <MenuItem label="Left" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />
                                  <MenuItem label="Right" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Align Panel", message: "Coming next." })} />
                                </div>
                              ) : null}
                            </div>

                            <div className="relative">
                              <MenuItem
                                label="Tab Bar"
                                right={<ChevronRight className="h-3.5 w-3.5" />}
                                keepOpen
                                onMouseEnter={() => setViewAppearanceSub("tabBar")}
                                onClick={() => setViewAppearanceSub((v) => (v === "tabBar" ? null : "tabBar"))}
                              />
                              {viewAppearanceSub === "tabBar" ? (
                                <div className="absolute right-full top-0 z-50 mr-1 w-max min-w-56 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                                  <MenuItem label="Multiple Tabs" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Tab Bar", message: "Coming next." })} />
                                  <MenuItem label="Single Tabs" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Tab Bar", message: "Coming next." })} />
                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Tab Bar", message: "Coming next." })} />
                                </div>
                              ) : null}
                            </div>

                            <div className="relative">
                              <MenuItem
                                label="Editor Actions Position"
                                right={<ChevronRight className="h-3.5 w-3.5" />}
                                keepOpen
                                onMouseEnter={() => setViewAppearanceSub("editorActionsPosition")}
                                onClick={() => setViewAppearanceSub((v) => (v === "editorActionsPosition" ? null : "editorActionsPosition"))}
                              />
                              {viewAppearanceSub === "editorActionsPosition" ? (
                                <div className="absolute right-full top-0 z-50 mr-1 w-max min-w-56 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                                  <MenuItem label="Tab Bar" right={<MenuCheck checked />} onClick={() => notify({ kind: "info", title: "Editor Actions", message: "Coming next." })} />
                                  <MenuItem label="Title Bar" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Editor Actions", message: "Coming next." })} />
                                  <MenuItem label="Hidden" right={<MenuCheck />} onClick={() => notify({ kind: "info", title: "Editor Actions", message: "Coming next." })} />
                                </div>
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
                          onMouseEnter={() => setViewMenuSub("editorLayout")}
                          onClick={() => setViewMenuSub((v) => (v === "editorLayout" ? null : "editorLayout"))}
                        />
                        {viewMenuSub === "editorLayout" ? (
                          <div className="absolute left-full top-0 z-50 ml-1 w-max min-w-64 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
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
                    className="rounded-md px-2 py-1 hover:bg-bg"
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
                    <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-panel p-1 shadow">
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
                    className="rounded-md px-2 py-1 hover:bg-bg"
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
                    <div className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-border bg-panel p-1 shadow">
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
              </div>
            </div>

            <div className="mx-4 hidden min-w-0 items-center justify-self-center md:flex">
              <div className="flex w-[520px] max-w-[42vw] items-center gap-1">
                <button
                  type="button"
                  className="ws-icon-btn"
                  onClick={() => notify({ kind: "info", title: "Back", message: "Coming next." })}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="ws-icon-btn"
                  onClick={() => notify({ kind: "info", title: "Forward", message: "Coming next." })}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="ws-input h-7 flex-1 cursor-pointer px-3 py-0 text-left text-[12px] text-muted"
                  onClick={() => setIsPaletteOpen(true)}
                >
                  Search or type a command…
                </button>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 justify-self-end">
              <div className="relative" data-account-menu-root>
                <button
                  type="button"
                  className="ws-icon-btn h-8 w-8 p-0"
                  onClick={() => {
                    setIsAccountMenuOpen((v) => !v);
                  }}
                  disabled={isAuthBusy}
                  aria-label={authProfile ? "Account" : "Sign in"}
                >
                  <div className="relative h-6 w-6 overflow-hidden rounded-full bg-[rgb(var(--p-panel2))]">
                    <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold leading-none text-text">
                      {avatarLetter}
                    </div>
                    {authProfile?.avatar_url ? (
                      <img
                        src={authProfile.avatar_url}
                        className="absolute inset-0 block h-full w-full object-cover"
                        alt="Profile"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                </button>

                {isAccountMenuOpen ? (
                  authProfile ? (
                    <div className="absolute right-0 top-full z-[80] mt-1 w-72 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
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
                  ) : (
                    <div className="absolute right-0 top-full z-[80] mt-1 w-72 max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-panel p-1 shadow max-h-[calc(100vh-80px)]">
                      <div className="px-3 py-2">
                        <div className="text-xs font-semibold text-text">Not signed in</div>
                        <div className="mt-0.5 text-[11px] text-muted">Sign in to sync credits and use Pompora AI.</div>
                      </div>
                      <MenuSep />
                      <MenuItem
                        label="Log in"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          void beginDesktopAuthWithMode("login");
                        }}
                      />
                      <MenuItem
                        label="Create account"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          void beginDesktopAuthWithMode("signup");
                        }}
                      />
                    </div>
                  )
                ) : null}
              </div>

              <button type="button" className="ws-icon-btn" onClick={() => openSettingsTab()}>
                <SettingsIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: mainGridTemplateColumns }}>
          <aside className="min-w-0 border-r border-border bg-panel">
            <div className="flex h-full flex-col items-center gap-2 py-2">
              <ActivityButton id="explorer" active={activity === "explorer"} onClick={setActivity} Icon={FolderOpen} />
              <ActivityButton id="search" active={activity === "search"} onClick={setActivity} Icon={Search} />
              <ActivityButton id="scm" active={activity === "scm"} onClick={setActivity} Icon={GitBranch} />
              <div className="flex-1" />
            </div>
          </aside>

          <aside className="relative min-h-0 min-w-0 border-r border-border bg-panel">
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
                onContextMenu={(info) => setExplorerMenu(info)}
                showTooltipForEl={showTooltipForEl}
                hideTooltip={hideTooltip}
                onOpenFolder={() => void openFolder()}
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
                onCreateNewFile={() => void createNewFile()}
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
                            setPendingReveal({ path: m.path, line: m.line });
                            await openFile(m.path);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-text">{m.path}</span>
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

          <main className="min-h-0 min-w-0 bg-bg">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-10 items-center gap-1 border-b border-border bg-panel px-2">
                <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-auto">
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
                <button type="button" className="ws-icon-btn" onClick={() => void openFolder()}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 flex flex-col">
                {!workspace.root ? (
                  <WelcomeScreen
                    recentWorkspaces={workspace.recent}
                    recentFiles={recentFiles}
                    onOpenFolder={() => void openFolder()}
                    onOpenFile={() => void openStandaloneFile()}
                    onOpenRecentWorkspace={(p) => void openRecent(p)}
                    onOpenRecentFile={(p) => void openRecentFile(p)}
                    onOpenChat={() => setIsChatDockOpen(true)}
                    onOpenCommandPalette={() => setIsPaletteOpen(true)}
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
                    title="POMPORA"
                    subtitle="Getting started with Pompora"
                    hint="Open a file from Explorer to start editing."
                  />
                ) : activeTab.path === SETTINGS_TAB_PATH ? (
                  <div className="min-h-0 flex-1 overflow-auto">
                    <SettingsScreen
                      settings={settings}
                      authProfile={authProfile}
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
                    />
                  </div>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 flex flex-col">
                      <div className="relative min-h-0 flex-1">
                        {activeTabChangeFile ? (
                        <DiffEditor
                          height="100%"
                          theme={themeName}
                          language={activeTab.language}
                          original={activeTabChangeFile.before ?? ""}
                          modified={typedEditorText !== null ? typedEditorText : (activeTabChangeFile.after ?? activeTab.content)}
                          onMount={(ed) => {
                            const mod = ed.getModifiedEditor();
                            editorRef.current = mod;
                            cursorListenerDisposeRef.current?.dispose();
                            cursorListenerDisposeRef.current = mod.onDidChangeCursorPosition((ev) => {
                              const p = ev.position;
                              setCursorPos({ line: p.lineNumber, col: p.column });
                            });
                            const p = mod.getPosition();
                            if (p) setCursorPos({ line: p.lineNumber, col: p.column });
                            mod.focus();
                          }}
                          options={{
                            readOnly: true,
                            renderSideBySide: false,
                            fontSize: 13,
                            minimap: { enabled: true },
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            automaticLayout: true,
                            padding: { top: 8, bottom: 8 },
                          }}
                        />
                      ) : (
                        <Editor
                          height="100%"
                          theme={themeName}
                          language={activeTab.language}
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
                            cursorListenerDisposeRef.current?.dispose();
                            cursorListenerDisposeRef.current = ed.onDidChangeCursorPosition((ev) => {
                              const p = ev.position;
                              setCursorPos({ line: p.lineNumber, col: p.column });
                            });
                            const p = ed.getPosition();
                            if (p) setCursorPos({ line: p.lineNumber, col: p.column });
                            ed.focus();
                          }}
                          options={{
                            fontSize: 13,
                            minimap: { enabled: true },
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            automaticLayout: true,
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
                <div className="relative border-t border-border bg-panel" style={{ height: terminalHeight }}>
                  <div
                    className="absolute left-0 top-0 z-20 h-1 w-full cursor-row-resize"
                    onMouseDown={(e) => {
                      terminalResizeStateRef.current = { startY: e.clientY, startH: terminalHeight };
                    }}
                  />

                  <div className="flex h-full min-h-0 flex-col">
                    <div className="flex items-center justify-between border-b border-border bg-panel px-2 py-1.5">
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
            <aside className="relative min-h-0 min-w-0 border-l border-border bg-panel">
              <div
                className="absolute left-0 top-0 z-20 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => {
                  chatResizeStateRef.current = { startX: e.clientX, startW: chatDockWidth };
                }}
              />
              <div className="flex h-full min-h-0 flex-col">
                {hasChatHistory && isChatHistoryOpen ? (
                  <div className="border-b border-transparent bg-panel px-3 pb-2">
                    <div className="ws-panel2 overflow-hidden rounded-xl border border-border">
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <Search className="h-4 w-4 text-muted" />
                          <input
                            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                            placeholder="Search"
                            value={chatHistoryQuery}
                            onChange={(e) => setChatHistoryQuery(e.currentTarget.value)}
                            autoFocus
                          />
                        </div>
                        <div className="shrink-0 rounded-md bg-panel px-2 py-1 text-[11px] text-muted">All Conversations</div>
                      </div>

                      <div className="h-2" />

                      <div className="max-h-56 overflow-auto px-1 pb-1">
                        {chatSessions
                          .slice()
                          .sort((a, b) => b.updatedAt - a.updatedAt)
                          .filter((s) => s.messages.some((m) => m.role === "user"))
                          .filter((s) => {
                            const q = chatHistoryQuery.trim().toLowerCase();
                            if (!q) return true;
                            const hay = `${s.title}\n${s.messages
                              .filter((m) => m.role === "user")
                              .map((m) => m.content)
                              .join("\n")}`.toLowerCase();
                            return hay.includes(q);
                          })
                          .map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className={`flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2 text-left focus-visible:outline-none hover:bg-panel ${
                                s.id === activeChatId ? "bg-panel" : ""
                              }`}
                              onClick={() => {
                                setActiveChatId(s.id);
                                setIsChatHistoryOpen(false);
                                window.setTimeout(() => chatComposerRef.current?.focus(), 0);
                              }}
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm text-text">{s.title}</div>
                                <div className="truncate text-[11px] text-muted">{workspacePathLabel}</div>
                              </div>
                              <div className="shrink-0 pt-0.5 text-[11px] text-muted">{formatRelTime(s.updatedAt)}</div>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : null}

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

                <div className="border-b border-border bg-panel px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-normal text-[#a39d9d]">{activeChat.title}</div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <div className="ws-segment">
                        <button
                          type="button"
                          className={`ws-segment-item ${chatDockTab === "chat" ? "ws-segment-item-active" : ""}`}
                          onClick={() => setChatDockTab("chat")}
                        >
                          Chat
                        </button>
                        {canShowChatLogs ? (
                          <button
                            type="button"
                            className={`ws-segment-item ${chatDockTab === "logs" ? "ws-segment-item-active" : ""}`}
                            onClick={() => setChatDockTab("logs")}
                          >
                            Logs
                          </button>
                        ) : null}
                      </div>

                      {hasChatHistory ? (
                        <button
                          type="button"
                          className="ws-icon-btn"
                          onClick={() => {
                            setIsChatHistoryOpen((v) => !v);
                            if (!isChatHistoryOpen) setChatHistoryQuery("");
                          }}
                        >
                          <ChevronDown className={`h-4 w-4 ${isChatHistoryOpen ? "rotate-180" : ""}`} />
                        </button>
                      ) : null}
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
                </div>

                <div
                  ref={chatScrollRef}
                  className={`min-h-0 flex-1 overflow-auto px-3 py-3 ${canUseAi && !activeChat.messages.length ? "flex items-center justify-center" : ""}`}
                >
                  {aiBlockedReason ? (
                    <div className="mb-3 rounded-lg border border-border bg-bg p-3 text-sm text-muted">
                      {aiBlockedReason}
                    </div>
                  ) : null}

                  {chatDockTab === "logs" ? (
                    <div className="space-y-3">
                      {(() => {
                        const all = (activeChat.logs ?? []).slice(-400);
                        if (!all.length) return <div className="text-sm text-muted">No logs yet.</div>;

                        const runIds = (activeChat.messages ?? [])
                          .filter((m) => m.role === "assistant" && m.kind === "agent_run" && m.id)
                          .map((m) => m.id as string);
                        const runIndex = new Map<string, number>(runIds.map((id, idx) => [id, idx + 1]));

                        const groups = new Map<string, ChatLogEntry[]>();
                        for (const l of all) {
                          const gid = l.groupId ?? "session";
                          const arr = groups.get(gid);
                          if (arr) arr.push(l);
                          else groups.set(gid, [l]);
                        }

                        const ordered = [...groups.entries()].sort((a, b) => {
                          const at = a[1][a[1].length - 1]?.ts ?? 0;
                          const bt = b[1][b[1].length - 1]?.ts ?? 0;
                          return bt - at;
                        });

                        return ordered.map(([gid, entries]) => {
                          const key = `${activeChatId}:${gid}`;
                          const isCollapsed = Boolean(logGroupCollapsed[key]);

                          const runMsg = (activeChat.messages ?? []).find((m) => m.id === gid && m.kind === "agent_run" && m.agentRun) ?? null;
                          const runStatus = runMsg?.agentRun?.status ?? (gid === "session" ? "done" : "running");
                          const title = gid === "session" ? "Session" : `Run ${runIndex.get(gid) ?? ""}`.trim();
                          const subtitle = gid === "session" ? "General" : "Agent";

                          return (
                            <div key={gid} className="ws-log-group">
                              <button
                                type="button"
                                className="ws-log-group-h"
                                onClick={() => setLogGroupCollapsed((prev) => ({ ...prev, [key]: !Boolean(prev[key]) }))}
                              >
                                <div className="min-w-0">
                                  <div className="ws-log-group-title">{title}</div>
                                  <div className="ws-log-group-sub">{subtitle}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`ws-log-status ${statusPillClass(
                                      runStatus === "error" ? "error" : runStatus === "done" ? "done" : "running"
                                    )}`}
                                  >
                                    {runStatus}
                                  </span>
                                  <ChevronDown className={`h-4 w-4 text-muted transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                                </div>
                              </button>

                              {!isCollapsed ? (
                                <div className="ws-log-group-b">
                                  <div className="space-y-2">
                                    {entries.map((l) => (
                                      <div key={l.id} className="ws-log-entry">
                                        <button
                                          type="button"
                                          className="ws-log-entry-h"
                                          onClick={() => toggleLogCollapsed(l.id)}
                                        >
                                          <div className="min-w-0">
                                            <div className="ws-log-entry-title">{l.title}</div>
                                            <div className="ws-log-entry-sub">{formatRelTime(l.ts)}</div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {l.status ? (
                                              <span
                                                className={`ws-log-status ${statusPillClass(
                                                  l.status === "pending" ? "pending" : l.status
                                                )}`}
                                              >
                                                {l.status}
                                              </span>
                                            ) : null}
                                            <ChevronDown
                                              className={`h-4 w-4 text-muted transition-transform ${
                                                l.collapsed ? "" : "rotate-180"
                                              }`}
                                            />
                                          </div>
                                        </button>
                                        {!l.collapsed && (l.details ?? []).length ? (
                                          <div className="ws-log-entry-b">
                                            <div className="ws-terminal-log">
                                              {(l.details ?? []).slice(-160).map((d, idx) => (
                                                <div key={idx} className="whitespace-pre-wrap break-words">
                                                  {d}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : activeChat.messages.length ? (
                      <div className="space-y-3">
                        {(activeChat.messages ?? []).filter((m) => m.role !== "meta").map((m, idx) => {
                          return (
                            <div key={m.id ?? idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div className="max-w-[92%]">
                                {m.role === "assistant" && m.kind === "agent_run" && m.agentRun ? (
                                  <AgentRunCard messageId={m.id ?? ""} ar={m.agentRun} onToggle={toggleAgentRunSection} />
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
                                ) : m.role === "assistant" && m.kind === "proposal" && m.proposal ? (
                                  <div className="ws-msg ws-msg-anim ws-msg-assistant">
                                    {(() => {
                                      const cs = activeChat.changeSet;
                                      const isCurrent = Boolean(cs && cs.id === m.proposal?.changeSetId);
                                      const isApplied = Boolean(cs && cs.id === m.proposal?.changeSetId && cs.applied);
                                      return (
                                        <>
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="text-[11px] text-muted">Proposal</div>
                                              <div className="mt-1 text-[13px] text-text">{m.proposal.title}</div>
                                              <div className="mt-1 text-[11px] text-muted">
                                                <span className="text-text">{m.proposal.stats.files} files</span>
                                                <span className="ml-2 text-emerald-300">+{m.proposal.stats.added}</span>
                                                <span className="ml-2 text-red-300">-{m.proposal.stats.removed}</span>
                                              </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                              <div className="text-[10px] text-muted">State</div>
                                              <div className="mt-1 text-[11px] text-text">
                                                {!isCurrent ? "outdated" : isApplied ? "applied" : "pending"}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="mt-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Plan</div>
                                            <div className="mt-1 space-y-1">
                                              {(m.proposal.plan ?? []).slice(0, 6).map((p, idx) => (
                                                <div key={idx} className="flex items-start gap-2 text-[12px] text-muted">
                                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--p-accent))]" />
                                                  <span className="whitespace-pre-wrap break-words">{p}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                          {(m.proposal.risks?.length ?? 0) > 0 ? (
                                            <div className="mt-3">
                                              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Warnings</div>
                                              <div className="mt-1 space-y-1">
                                                {(m.proposal.risks ?? []).slice(0, 6).map((r, idx) => (
                                                  <div key={idx} className="text-[12px] text-muted whitespace-pre-wrap break-words">
                                                    {r}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null}

                                          <div className="mt-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Files</div>
                                            <div className="mt-1 max-h-52 overflow-auto rounded-lg border border-border bg-bg">
                                              {(m.proposal.files ?? []).map((f, idx) => {
                                                const badge = f.kind === "delete" ? "D" : f.kind === "rename" ? "R" : f.isNew ? "A" : "M";
                                                const badgeCls =
                                                  f.kind === "delete"
                                                    ? "bg-red-500/15 text-red-300"
                                                    : f.kind === "rename"
                                                      ? "bg-sky-500/15 text-sky-300"
                                                      : "bg-emerald-500/15 text-emerald-300";
                                                const full = cs?.files.find((x) => x.kind === "write" && x.path === f.path) ?? null;
                                                const canPreview = Boolean(full && full.kind === "write" && typeof full.before === "string" && typeof full.after === "string");
                                                const isOpen = Boolean(proposalPreviewOpen[f.path]);
                                                const FileIcon = fileIconFor(f.path);

                                                return (
                                                  <div key={`${f.kind}:${f.path}:${idx}`} className="border-b border-border/60 last:border-b-0">
                                                    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                                                      <button
                                                        type="button"
                                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                                        onClick={() => {
                                                          if (f.kind === "write") void openFile(f.path);
                                                        }}
                                                      >
                                                        <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] ${badgeCls}`}>{badge}</span>
                                                        <FileIcon className="h-4 w-4 text-muted" />
                                                        <span className="min-w-0 truncate text-[12px] text-text">{f.path}</span>
                                                      </button>

                                                      <div className="flex shrink-0 items-center gap-1">
                                                        {f.kind === "write" && canPreview ? (
                                                          <button
                                                            type="button"
                                                            className="ws-btn ws-btn-secondary h-6 px-2 text-[11px]"
                                                            onClick={() =>
                                                              setProposalPreviewOpen((prev) => ({ ...prev, [f.path]: !Boolean(prev[f.path]) }))
                                                            }
                                                          >
                                                            <Eye className="mr-1 inline-block h-3.5 w-3.5" />
                                                            {isOpen ? "Hide" : "Preview"}
                                                          </button>
                                                        ) : null}

                                                        {f.kind === "write" && isCurrent && !isApplied ? (
                                                          <>
                                                            <button
                                                              type="button"
                                                              className="ws-btn ws-btn-secondary h-6 px-2 text-[11px]"
                                                              disabled={chatApplying}
                                                              onClick={() => void rejectFileChange(f.path)}
                                                            >
                                                              Reject
                                                            </button>
                                                            <button
                                                              type="button"
                                                              className="ws-btn ws-btn-primary h-6 px-2 text-[11px]"
                                                              disabled={chatApplying}
                                                              onClick={() => acceptFileChange(f.path)}
                                                            >
                                                              Apply
                                                            </button>
                                                          </>
                                                        ) : null}
                                                      </div>
                                                    </div>

                                                    {f.kind === "write" && canPreview ? (
                                                      <div
                                                        className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                                                          isOpen ? "max-h-[360px] opacity-100" : "max-h-0 opacity-0"
                                                        }`}
                                                      >
                                                        <div className="px-2 pb-2">
                                                          <div className="rounded-lg border border-border bg-panel">
                                                            <DiffEditor
                                                              height="240px"
                                                              theme={themeName}
                                                              language={detectLanguage(f.path)}
                                                              original={full?.before ?? ""}
                                                              modified={full?.after ?? ""}
                                                              options={{
                                                                readOnly: true,
                                                                renderSideBySide: false,
                                                                minimap: { enabled: false },
                                                                scrollBeyondLastLine: false,
                                                                wordWrap: "on",
                                                                automaticLayout: true,
                                                                fontSize: 12,
                                                                padding: { top: 8, bottom: 8 },
                                                              }}
                                                            />
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>

                                          <div className="mt-3 flex items-center justify-end gap-2">
                                            <button
                                              type="button"
                                              className="ws-btn ws-btn-secondary h-7 px-2"
                                              disabled={!isCurrent || chatApplying}
                                              onClick={() => void rejectAllChanges()}
                                            >
                                              Discard
                                            </button>
                                            <button
                                              type="button"
                                              className="ws-btn h-7 border border-accent bg-accent px-2 text-white hover:opacity-90 disabled:opacity-50"
                                              disabled={!isCurrent || isApplied || chatApplying}
                                              onClick={() => acceptAllChanges()}
                                            >
                                              Apply
                                            </button>
                                          </div>
                                        </>
                                      );
                                    })()}
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
                                          <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-panel p-1 shadow">
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
                        <img src="/logo_transparent_bigger.png" alt="Pompora" className="h-47 w-47 opacity-90" />
                        <div className="mt-4 text-base font-semibold text-text">Pompora Code</div>
                        <div className="mt-1 max-w-[320px] text-sm text-muted">Build and improve your codebase - privately.</div>
                      </div>
                    )}
                </div>

                <div className="bg-panel px-3 py-2">
                  <div className="ws-panel2 rounded-md border border-border p-2">
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
                            <div className="absolute left-0 bottom-full z-50 mb-2 w-56 overflow-hidden rounded-xl border border-border bg-panel shadow">
                              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Pompora</div>

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
                                            ? "Log in to use Pompora AI"
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

                              <div className="border-t border-border" />
                              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">BYOK</div>

                              {providerChoices
                                .filter((p) => p.id !== "pompora")
                                .map((p) => {
                                  const st = providerKeyStatuses[p.id];
                                  const missingKey = p.api ? st?.is_configured !== true : false;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[rgb(var(--p-panel2))] ${
                                        (settings.active_provider ?? "") === p.id ? "bg-[rgb(var(--p-panel2))]" : ""
                                      } ${missingKey ? "text-muted opacity-60" : "text-text"}`}
                                      onClick={() => {
                                        void changeProvider(p.id);
                                        setIsModelPickerOpen(false);
                                      }}
                                      onMouseEnter={(e) => {
                                        if (missingKey) {
                                          showTooltipForEl(e.currentTarget, "Add an API key in Settings (Ctrl+,)", "tr");
                                        }
                                      }}
                                      onMouseLeave={hideTooltip}
                                    >
                                      <span className={p.api ? "" : "text-muted"}>{p.label}</span>
                                      <span className="text-xs text-muted">{p.api ? (missingKey ? "API key" : "API") : "Local"}</span>
                                    </button>
                                  );
                                })}
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

        <footer className="flex items-center justify-end border-t border-border bg-panel px-3 text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <button type="button" className="ws-footer-btn" onClick={() => {}}>
              {activeTab ? activeTab.path : "No file"}
            </button>
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
            <button type="button" className="ws-footer-btn" onClick={() => {}}>
              Free plan
            </button>
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

      {explorerMenu ? (
        <ContextMenu
          x={explorerMenu.x}
          y={explorerMenu.y}
          onClose={() => setExplorerMenu(null)}
          items={[
            { id: "newFile", label: "New File...", onClick: () => void createNewFile() },
            { id: "newFolder", label: "New Folder...", onClick: () => void createNewFolder() },
            ...(explorerMenu.path === ""
              ? [
                  { id: "refresh", label: "Refresh", onClick: () => void refreshRoot() },
                  { id: "closeFolder", label: "Close Folder", onClick: () => void closeFolder() },
                ]
              : [
                  { id: "rename", label: "Rename...", onClick: () => void renameSelected() },
                  { id: "delete", label: "Delete", onClick: () => void deleteSelected() },
                  { id: "copyPath", label: "Copy Relative Path", onClick: () => void copyText(explorerMenu.path) },
                ]),
            {
              id: "copyFullPath",
              label: "Copy Full Path",
              onClick: () => {
                const root = (workspace.root ?? "").replace(/\\/g, "/").replace(/\/$/, "");
                if (explorerMenu.path === "") {
                  void copyText(root);
                  return;
                }
                const rel = explorerMenu.path.replace(/^\//, "");
                void copyText(root && rel ? `${root}/${rel}` : explorerMenu.path);
              },
            },
          ]}
        />
      ) : null}

      {wsTooltip ? (
        <div
          className="fixed z-[9999] pointer-events-none select-none ws-msg-anim max-w-[320px] rounded-md border border-border ws-panel2 px-2 py-1 text-[11px] text-text shadow-xl backdrop-blur-sm"
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
                <span className="truncate">{p}</span>
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
      className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-md ${
        active ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"
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
      <div className="border-b border-border bg-panel px-3 py-2 text-xs font-normal text-muted">
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
  onContextMenu: (info: { x: number; y: number; path: string; isDir: boolean }) => void;
  showTooltipForEl: (el: HTMLElement, text: string, align?: "tl" | "tr") => void;
  hideTooltip: () => void;
  onOpenFolder: () => void;
  onOpenRecent: (p: string) => void;
  onToggleDir: (dir: string) => void;
  onSelect: (p: string) => void;
  onOpenFile: (p: string) => void;
  onRefresh: () => void;
  onCreateNewFile: () => void;
  onCreateNewFolder: () => void;
}) {
  if (!props.workspaceRoot) {
    return (
      <Panel title="Explorer">
        <WelcomeScreen
          title="No folder open"
          subtitle="Open a folder to browse files and start editing."
          onOpenFolder={props.onOpenFolder}
          onOpenFile={undefined}
          recentWorkspaces={props.recent}
          recentFiles={[]}
          onOpenRecentWorkspace={props.onOpenRecent}
          onOpenRecentFile={undefined}
          onOpenChat={undefined}
          onOpenCommandPalette={undefined}
          useBrandFont={false}
          compact
        />
      </Panel>
    );
  }

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
            onClick={props.onCreateNewFile}
          >
            <FileText className="h-4 w-4" />
          </button>
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
          entries={[rootNode]}
          explorer={props.explorer}
          expandedDirs={props.expandedDirs}
          selectedPath={props.selectedPath}
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
  entries: DirEntryInfo[];
  explorer: Record<string, DirEntryInfo[]>;
  expandedDirs: Set<string>;
  selectedPath: string | null;
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
        const isSelected = props.selectedPath === e.path;
        const rowCls = isSelected
          ? "bg-panel text-text"
          : "text-muted hover:bg-panel hover:text-text hover:translate-x-[1px] hover:-translate-y-[0.5px]";
        const markerCls = isSelected ? "bg-accent opacity-100" : "opacity-0";
        if (e.is_dir) {
          const isExpanded = props.expandedDirs.has(e.path);
          const children = props.explorer[e.path] ?? [];
          const isRoot = e.path === "";
          return (
            <div key={e.path}>
              <button
                type="button"
                className={`group relative flex w-full items-center gap-2 rounded-md px-2 py-0.5 text-left text-[13px] transition-all duration-150 ${rowCls}`}
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
                <span aria-hidden className={`absolute left-0 top-1.5 h-4 w-0.5 rounded ${markerCls}`} />
                <ChevronRight
                  className={`h-4 w-4 text-muted transition-transform duration-150 group-hover:text-text ${isExpanded ? "rotate-90" : ""}`}
                />
                {isRoot ? (
                  <FolderOpen className="h-4 w-4 text-muted transition-transform duration-150 group-hover:scale-[1.03] group-hover:text-text" />
                ) : (
                  <Folder className="h-4 w-4 text-muted transition-transform duration-150 group-hover:scale-[1.03] group-hover:text-text" />
                )}
                <span className={`truncate ${isRoot ? "font-medium text-text" : ""}`}>{e.name}</span>
              </button>
              {isExpanded ? (
                <div className="ml-4 border-l border-border/60 pl-2">
                  <Tree
                    prefix={e.path}
                    entries={children}
                    explorer={props.explorer}
                    expandedDirs={props.expandedDirs}
                    selectedPath={props.selectedPath}
                    onContextMenu={props.onContextMenu}
                    workspaceRoot={props.workspaceRoot}
                    showTooltipForEl={props.showTooltipForEl}
                    hideTooltip={props.hideTooltip}
                    onToggleDir={props.onToggleDir}
                    onSelect={props.onSelect}
                    onOpenFile={props.onOpenFile}
                  />
                </div>
              ) : null}
            </div>
          );
        }

        const Icon = fileIconFor(e.path);
        return (
          <button
            key={e.path}
            type="button"
            className={`group relative flex w-full items-center gap-2 rounded-md px-2 py-0.5 text-left text-[13px] transition-all duration-150 ${rowCls}`}
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
            <span aria-hidden className={`absolute left-0 top-1.5 h-4 w-0.5 rounded ${markerCls}`} />
            <span className="inline-block w-4" />
            <Icon className="h-4 w-4 text-muted transition-transform duration-150 group-hover:scale-[1.03] group-hover:text-text" />
            <span className="truncate">{e.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function ContextMenu(props: {
  x: number;
  y: number;
  onClose: () => void;
  items: Array<{ id: string; label: string; onClick: () => void }>;
}) {
  return (
    <div className="fixed inset-0 z-50" onMouseDown={props.onClose}>
      <div
        className="absolute w-56 overflow-hidden rounded border border-border bg-panel shadow-2xl"
        style={{ left: props.x, top: props.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {props.items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-muted hover:bg-bg hover:text-text"
            onClick={() => {
              it.onClick();
              props.onClose();
            }}
          >
            <span>{it.label}</span>
          </button>
        ))}
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

        <span
          aria-hidden
          className={`absolute bottom-0 left-2 right-2 h-px rounded bg-accent transition-opacity ${
            props.active ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </div>
  );
}

function WelcomeScreen(props: {
  recentWorkspaces: string[];
  recentFiles?: string[];
  onOpenFolder: () => void;
  onOpenFile?: () => void;
  onOpenRecentWorkspace: (p: string) => void;
  onOpenRecentFile?: (p: string) => void;
  onOpenChat?: () => void;
  onOpenCommandPalette?: () => void;
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

      <div className={`relative z-10 flex h-full w-full flex-col items-center ${isCompact ? "justify-start" : "justify-center"}`}>
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
                {title}
              </div>
              <div className={`${isCompact ? "mt-1 text-[11px]" : "mt-2 text-sm"} text-muted`}>{subtitle}</div>
              <div className={`${isCompact ? "mt-1 text-[10px]" : "mt-1 text-xs"} text-muted`}>{hint}</div>
            </div>

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
                    <span className="ws-kbd">Ctrl+L</span>
                  </button>
                  <button
                    type="button"
                    className="ws-welcome-row"
                    onClick={() => props.onOpenCommandPalette?.()}
                    disabled={!props.onOpenCommandPalette}
                  >
                    <span className="truncate">Open Command Palette</span>
                    <span className="ws-kbd">Ctrl+Shift+P</span>
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
                          return (
                            <button key={p} type="button" className="ws-welcome-row" onClick={() => props.onOpenRecentFile?.(p)}>
                              <span className="min-w-0 flex-1 truncate">{r.name}</span>
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
}

const SettingsScreen: React.FC<SettingsScreenProps> = (props) => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sectionList = useMemo(
    () =>
      [
        { id: "common", label: "Commonly Used", icon: Star },
        { id: "workspace", label: "Workspace", icon: FolderOpen },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "ai", label: "AI", icon: Wand2 },
      ] as const,
    []
  );

  const providerStatusLabel = props.keyStatus?.is_configured ? "Configured" : "Not configured";

  type SectionId = (typeof sectionList)[number]["id"];
  const [activeSection, setActiveSection] = useState<SectionId>("workspace");

  const sectionMeta = useMemo(() => {
    const map: Record<SectionId, { title: string; description: string }> = {
      common: { title: "Commonly Used", description: "Frequently changed settings" },
      workspace: { title: "Workspace", description: "Workspace folder and recent workspaces" },
      appearance: { title: "Appearance", description: "Theme" },
      ai: { title: "AI", description: "Provider and offline mode" },
    };
    return map;
  }, []);

  useEffect(() => {
    const allowed = new Set(sectionList.map((s) => s.id));
    if (!allowed.has(activeSection)) setActiveSection("workspace");
  }, [activeSection, sectionList]);

  type SettingItem = {
    id: string;
    section: SectionId;
    title: string;
    description: string;
    renderControl: () => ReactNode;
    keywords?: string;
  };

  const commonIds = useMemo(
    () =>
      new Set<string>([
        "workspace.folder",
        "appearance.theme",
        "ai.offline",
      ]),
    []
  );

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

    return (
      <div ref={wrapRef} className={`relative ${p.widthClassName ?? ""}`.trim()}>
        <button
          type="button"
          className="ws-vscode-dropdown-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="truncate">{active?.label ?? ""}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
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

  const Switch = (p: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => {
    return (
      <button
        type="button"
        className={`ws-vscode-switch ${p.disabled ? "opacity-60" : ""}`}
        data-checked={p.checked ? "true" : "false"}
        onClick={() => {
          if (p.disabled) return;
          p.onChange(!p.checked);
        }}
        aria-checked={p.checked}
        role="switch"
      >
        <span className="ws-vscode-switch-thumb" />
      </button>
    );
  };

  const settingsItems = useMemo<SettingItem[]>(
    () => [
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
        id: "appearance.theme",
        section: "appearance",
        title: "Theme",
        description: "Choose the color theme.",
        keywords: "theme dark light appearance",
        renderControl: () => (
          <Dropdown
            value={props.settings.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(v) => props.onChangeTheme(v as Theme)}
          />
        ),
      },
      {
        id: "ai.offline",
        section: "ai",
        title: "AI: Offline Mode",
        description: "Disable all network AI calls.",
        keywords: "offline ai network",
        renderControl: () => <Switch checked={props.settings.offline_mode} onChange={() => props.onToggleOffline()} disabled={props.isTogglingOffline} />,
      },
      ...(props.settings.active_provider && props.settings.active_provider !== "pompora"
        ? ([
            {
              id: "ai.apiKey",
              section: "ai" as const,
              title: "AI: API Key",
              description: "Paste your API key for the selected provider.",
              keywords: "api key security",
              renderControl: () => (
                <input
                  className="ws-vscode-input"
                  placeholder="Paste your API key"
                  value={props.apiKeyDraft}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => props.onApiKeyDraft(e.target.value)}
                />
              ),
            },
          ] satisfies SettingItem[])
        : ([] as SettingItem[])),
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
    ],
    [props]
  );

  const filteredItems = useMemo(() => {
    if (!q) {
      if (activeSection === "common") return settingsItems.filter((x) => commonIds.has(x.id));
      return settingsItems.filter((x) => x.section === activeSection);
    }
    const qq = q.toLowerCase();
    return settingsItems.filter((x) => `${x.title} ${x.description} ${x.keywords ?? ""}`.toLowerCase().includes(qq));
  }, [activeSection, commonIds, q, settingsItems]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="border-b border-border bg-panel px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-muted" />
            <div className="text-sm font-semibold text-text">Settings</div>
          </div>

          <button
            type="button"
            className="ws-vscode-btn ws-vscode-btn-primary"
            onClick={props.onSaveSettings}
            disabled={!props.isSettingsLoaded || props.isSavingSettings}
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-[260px_1fr]">
          <aside className="min-w-0 border-r border-border bg-panel">
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1 overflow-auto px-2 pb-3 pt-4">
                <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">User</div>
                <div className="space-y-0.5">
                  {sectionList.map((s) => {
                    const isActive = !q && s.id === activeSection;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`ws-vscode-nav-item ${isActive ? "ws-vscode-nav-item-active" : ""}`}
                        onClick={() => {
                          setActiveSection(s.id);
                          setQuery("");
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <s.icon className="h-4 w-4" />
                          <span className="truncate">{s.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 overflow-auto bg-bg">
            <div className="mx-auto w-full max-w-[980px] p-4">
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    className="ws-vscode-search pl-9"
                    placeholder="Search settings"
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                  />
                </div>
              </div>

              <div className="mb-3">
                <div className="text-sm font-semibold text-text">{q ? "Search results" : sectionMeta[activeSection].title}</div>
                <div className="mt-1 text-xs text-muted">
                  {q ? `Showing ${filteredItems.length} setting(s)` : sectionMeta[activeSection].description}
                </div>
              </div>

              <div className="ws-vscode-settings">
                {filteredItems.length ? (
                  filteredItems.map((it) => (
                    <div key={it.id} className="ws-vscode-setting-row">
                      <div className="min-w-0">
                        <div className="text-sm text-text">{it.title}</div>
                        <div className="mt-0.5 text-xs text-muted">{it.description}</div>
                      </div>
                      <div className="ws-vscode-setting-control">{it.renderControl()}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted">No settings found.</div>
                )}
              </div>

              {activeSection === "workspace" && !q ? (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Recent workspaces</div>
                  {props.recentWorkspaces.length ? (
                    <div className="ws-vscode-settings">
                      {props.recentWorkspaces.slice(0, 12).map((p) => (
                        <button key={p} type="button" className="ws-vscode-list-row" onClick={() => props.onOpenRecent(p)}>
                          <span className="truncate">{p}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted">No recent workspaces.</div>
                  )}
                </div>
              ) : null}

              {activeSection === "ai" && !q ? (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-muted">Status: {providerStatusLabel}</div>

                  {props.settings.active_provider === "pompora" && !props.authProfile ? (
                    <div className="rounded-xl border border-border bg-panel p-3">
                      <div className="text-sm font-semibold text-text">Connect to Pompora</div>
                      <div className="mt-1 text-xs text-muted">
                        Log in to sync your plan and credits across devices.
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="ws-vscode-btn ws-vscode-btn-primary"
                          onClick={props.onLoginToPompora}
                          disabled={props.isAuthBusy}
                        >
                          Log in
                        </button>
                        <button
                          type="button"
                          className="ws-vscode-btn"
                          onClick={props.onSignupToPompora}
                          disabled={props.isAuthBusy}
                        >
                          Create account
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {props.secretsError ? <div className="ws-vscode-error">{props.secretsError}</div> : null}

                  <div className="flex flex-wrap gap-2">
                    {props.settings.active_provider && props.settings.active_provider !== "pompora" ? (
                      <>
                        <button
                          type="button"
                          className="ws-vscode-btn"
                          onClick={props.onStoreKey}
                          disabled={
                            !props.isSettingsLoaded ||
                            props.isKeyOperationInProgress ||
                            !props.apiKeyDraft.trim() ||
                            !props.settings.active_provider
                          }
                        >
                          Save Key
                        </button>
                        <button
                          type="button"
                          className="ws-vscode-btn ws-vscode-btn-ghost"
                          onClick={props.onClearKey}
                          disabled={!props.isSettingsLoaded || props.isKeyOperationInProgress || !props.settings.active_provider}
                        >
                          Clear Key
                        </button>
                      </>
                    ) : null}
                    <div className="flex-1" />
                    <button type="button" className="ws-vscode-btn" onClick={props.onDebugGemini}>
                      Test AI
                    </button>
                  </div>
                  {props.debugResult ? <pre className="ws-vscode-pre">{props.debugResult}</pre> : null}

                  {props.settings.active_provider === "pompora" ? (
                    <div className="overflow-hidden rounded-xl border border-border bg-panel">
                      <div className="border-b border-border px-4 py-3">
                        <div className="text-sm font-semibold text-text">Pompora AI Plans</div>
                        <div className="mt-1 text-xs text-muted">
                          Credits keep the service fast and fair. <span className="text-text">2 credits = 1 request</span>.
                        </div>
                      </div>

                      <div className="grid gap-3 p-3 md:grid-cols-3">
                        <div className="rounded-lg border border-border bg-bg p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-text">Starter</div>
                            <div className="text-xs text-muted">Free</div>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-muted">
                            <div>25 Slow Credits (reset every 2 weeks)</div>
                            <div>Unlimited tab completions</div>
                            <div>Unlimited inline edits</div>
                            <div>Local AI (slow thinking)</div>
                            <div>BYOK support</div>
                          </div>
                          <button
                            type="button"
                            className="mt-3 w-full rounded-md bg-[rgb(var(--p-panel2))] px-3 py-2 text-xs font-semibold text-text hover:opacity-90"
                            onClick={() => void openUrl("https://pompora.dev/pricing")}
                          >
                            Start Free
                          </button>
                        </div>

                        <div className="rounded-lg border border-border bg-gradient-to-b from-[rgba(255,255,255,0.06)] to-[rgba(255,255,255,0.02)] p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold text-text">Plus</div>
                              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                                Most Popular
                              </div>
                            </div>
                            <div className="text-xs text-text">$10 / month</div>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-muted">
                            <div>150 Fast Credits / month (daily cap: 100)</div>
                            <div>50 Slow Credits (reset every 2 weeks)</div>
                            <div>Fast thinking enabled</div>
                            <div>Priority execution</div>
                            <div>BYOK support</div>
                          </div>
                          <button
                            type="button"
                            className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                            onClick={() => void openUrl("https://pompora.dev/pricing")}
                          >
                            Upgrade to Plus
                          </button>
                        </div>

                        <div className="rounded-lg border border-border bg-bg p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-text">Pro</div>
                            <div className="text-xs text-text">$20 / month</div>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-muted">
                            <div>300 Fast Credits / month (daily cap: 150)</div>
                            <div>150 Slow Credits (reset every 2 weeks)</div>
                            <div>Reasoning + fast thinking</div>
                            <div>Highest priority</div>
                            <div>Advanced agents</div>
                            <div>BYOK support</div>
                          </div>
                          <button
                            type="button"
                            className="mt-3 w-full rounded-md bg-[rgb(var(--p-panel2))] px-3 py-2 text-xs font-semibold text-text hover:opacity-90"
                            onClick={() => void openUrl("https://pompora.dev/pricing")}
                          >
                            Go Pro
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {q ? <div className="mt-3 text-xs text-muted">Tip: click a category on the left to exit search.</div> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
