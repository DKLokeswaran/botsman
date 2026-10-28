import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isPermissionGranted, onAction, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useEffect, useRef, useState } from "react";
import {
  HermesClient,
  HermesError,
  formatPush,
  openRequestIds,
  parsePush,
  routeFocus,
  type GatewayEvent,
  type LoginMaterial,
  type ProfileRow,
  type PushRoute,
  type ServerRequest,
  type SessionRow,
} from "@hermes-bots/gateway-client";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Reply, UserLine } from "./markdown";
import { tauriHttp, tauriSocket } from "./gateway";

const DEFAULT_SERVER = "http://100.113.35.96:9119";
const LEGACY_SERVER = "http://devbox.tail2eeb02.ts.net:9119";
const SERVER_KEY = "hermes-bots-server";

function preferredServer(stored: string | null): string {
  if (!stored) {
    return DEFAULT_SERVER;
  }
  const normalized = stored.trim().replace(/\/+$/, "");
  if (normalized.toLowerCase() === LEGACY_SERVER) {
    return DEFAULT_SERVER;
  }
  return normalized;
}

type Line = { role: string; text: string; messageId: string; seq: number | null };
type Approval = {
  id: string;
  sessionId: string;
  requestId: string;
  description: string;
  command: string;
  resolvedLabel: string | null;
};
type Question = {
  id: string;
  sessionId: string;
  requestId: string;
  text: string;
  resolvedLabel: string | null;
};
type Focus = {
  target: string;
  requestId: string;
  messageId: string;
  seq: number | null;
  resolved: boolean;
  messageIndex: number;
};
type Staged = { name: string; url: string | null };
type Vault = { username: string; refreshToken: string; provider: string };

function blankLine(role: string, text: string, messageId = "", seq: number | null = null): Line {
  return { role, text, messageId, seq };
}

function messageIdFrom(payload: Record<string, unknown>): string {
  const turn = payload.persisted_turn;
  if (!turn || typeof turn !== "object") {
    return "";
  }
  const record = turn as Record<string, unknown>;
  if (typeof record.final_assistant_row_id === "number") {
    return String(record.final_assistant_row_id);
  }
  return typeof record.submission_id === "string" ? record.submission_id : "";
}

function routeFrom(kind: PushRoute["kind"], title: string, body: string, sessionId: string, requestId: string, messageId: string, seq: number | null): PushRoute {
  return {
    kind,
    title,
    body,
    sessionId,
    profile: "",
    requestId,
    messageId,
    seq,
    action: null,
  };
}

async function toast(title: string, body: string, route?: PushRoute) {
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({ title, body, extra: route ? { route: formatPush(route) } : undefined });
  }
}

async function hidden() {
  const window = getCurrentWindow();
  const visible = await window.isVisible();
  const minimized = await window.isMinimized();
  return !visible || minimized;
}

function readVault(raw: string | null): Vault | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Vault>;
    if (typeof parsed.username !== "string") {
      return null;
    }
    return {
      username: parsed.username,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : "",
      provider: typeof parsed.provider === "string" && parsed.provider ? parsed.provider : "basic",
    };
  } catch {
    return null;
  }
}

export function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Signed out");
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [showCommand, setShowCommand] = useState(false);
  const [draft, setDraft] = useState("");
  const [ime, setIme] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [autostart, setAutostart] = useState(false);
  const clientRef = useRef<HermesClient | null>(null);
  const materialRef = useRef<LoginMaterial | null>(null);
  const seqs = useRef<Record<string, number>>({});
  const liveRef = useRef<string | null>(null);
  const closing = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const approvalRef = useRef<HTMLElement>(null);
  const questionRef = useRef<HTMLElement>(null);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);
  const linesRef = useRef<Line[]>([]);
  const approvalMirror = useRef<Approval | null>(null);
  const questionMirror = useRef<Question | null>(null);
  const pendingRoute = useRef<PushRoute | null>(null);
  const lastRoute = useRef<PushRoute | null>(null);
  const revealRef = useRef<(route: PushRoute | null) => void>(() => undefined);
  const resolvedIds = useRef<Set<string>>(new Set());
  const answeredHere = useRef<Set<string>>(new Set());

  useEffect(() => {
    liveRef.current = liveId;
  }, [liveId]);

  useEffect(() => {
    if (!approval) {
      return;
    }
    approvalRef.current?.scrollIntoView({ block: "end" });
  }, [approval, focus]);

  useEffect(() => {
    if (focus?.target === "question") {
      questionRef.current?.scrollIntoView({ block: "end" });
    }
    if (focus?.target === "message" && focus.messageIndex >= 0) {
      lineRefs.current[focus.messageIndex]?.scrollIntoView({ block: "center" });
    }
  }, [focus, lines, question]);

  useEffect(() => {
    let alive = true;
    let stopAction: (() => void) | undefined;
    let stopTray: (() => void) | undefined;
    void onAction((event) => {
      const raw = event.notification?.extra?.route;
      const route = typeof raw === "string" ? parsePush(raw) : null;
      lastRoute.current = null;
      revealRef.current(route);
    }).then((listener) => {
      if (!alive) {
        void listener.unregister();
        return;
      }
      stopAction = () => {
        void listener.unregister();
      };
    });
    void listen("tray-open", () => {
      const route = lastRoute.current;
      lastRoute.current = null;
      if (route) {
        revealRef.current(route);
      }
    }).then((unlisten) => {
      if (!alive) {
        unlisten();
        return;
      }
      stopTray = unlisten;
    });
    return () => {
      alive = false;
      stopAction?.();
      stopTray?.();
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(SERVER_KEY);
    const url = preferredServer(stored);
    if (stored !== url) {
      localStorage.setItem(SERVER_KEY, url);
    }
    setServerUrl(url);
    void isEnabled()
      .then(setAutostart)
      .catch(() => undefined);
    void (async () => {
      try {
        const saved = readVault(await invoke<string | null>("vault_load"));
        if (!saved) {
          return;
        }
        setUsername(saved.username);
        if (!saved.refreshToken) {
          setStatus("Sign in again");
          return;
        }
        await restore(saved, url);
      } catch {
        setStatus("Sign in again");
      }
    })();
    return () => {
      closing.current = true;
      clientRef.current?.close();
    };
    // Boot once. restore is stable enough for the saved login on this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rememberApproval(card: Approval | null) {
    approvalMirror.current = card;
    setApproval(card);
  }

  function rememberQuestion(card: Question | null) {
    questionMirror.current = card;
    setQuestion(card);
  }

  function commitLines(recipe: (current: Line[]) => Line[]) {
    const next = recipe(linesRef.current);
    linesRef.current = next;
    setLines(next);
  }

  function notify(title: string, body: string, route?: PushRoute) {
    if (route) {
      lastRoute.current = route;
    }
    void toast(title, body, route);
  }

  function forgetApproval(id: string, reason: string | null) {
    if (!id) {
      return;
    }
    resolvedIds.current.add(id);
    const current = approvalMirror.current;
    if (!current || (current.id !== id && current.requestId !== id)) {
      return;
    }
    resolvedIds.current.add(current.id);
    if (answeredHere.current.has(current.id) || reason !== "resolved") {
      rememberApproval(null);
      return;
    }
    rememberApproval({ ...current, resolvedLabel: "Approved on another device" });
  }

  function syncOpenApprovals(open: ServerRequest[]) {
    const ids = new Set(open.filter((request) => request.method === "approval").map((request) => request.id));
    const current = approvalMirror.current;
    if (!current || current.resolvedLabel || resolvedIds.current.has(current.id)) {
      return;
    }
    if (!ids.has(current.id)) {
      rememberApproval(null);
    }
  }

  function holdsQuestion(request: ServerRequest): boolean {
    const route = pendingRoute.current;
    if (!route || route.kind !== "clarify") {
      return false;
    }
    const session = String(request.params.session_id ?? "");
    if (route.sessionId && session && route.sessionId !== session) {
      return false;
    }
    if (!route.requestId || route.requestId === request.id) {
      return true;
    }
    const questions = Array.isArray(request.params.questions) ? request.params.questions : [];
    return questions.some((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      return String((item as Record<string, unknown>).qid ?? "") === route.requestId;
    });
  }

  function liveOpenRequests(): ServerRequest[] {
    const requests: ServerRequest[] = [];
    const card = approvalMirror.current;
    if (card && !card.resolvedLabel) {
      requests.push({ id: card.id, method: "approval", params: { request_id: card.requestId } });
    }
    const asked = questionMirror.current;
    if (asked && !asked.resolvedLabel) {
      requests.push({
        id: asked.id,
        method: "clarify",
        params: { questions: [{ qid: asked.requestId }] },
      });
    }
    return requests;
  }

  function placeFocus(route: PushRoute, open: ServerRequest[], transcript: Line[]) {
    const landed = routeFocus(
      route,
      openRequestIds(open.map((request) => ({ id: request.id, params: request.params }))),
      transcript.map((line) => ({ messageId: line.messageId, seq: line.seq })),
    );
    setFocus({
      target: landed.target,
      requestId: landed.requestId,
      messageId: landed.messageId,
      seq: landed.seq,
      resolved: landed.resolved,
      messageIndex: landed.messageIndex,
    });
    if (landed.target === "approval" && landed.resolved) {
      const live = approvalMirror.current;
      const matches = Boolean(live && (live.requestId === route.requestId || live.id === route.requestId));
      if (!matches) {
        rememberApproval({
          id: `push-${route.requestId}`,
          sessionId: route.sessionId,
          requestId: route.requestId,
          description: route.body || route.title || "Approval",
          command: "",
          resolvedLabel: "Resolved",
        });
        setShowCommand(false);
      }
    }
    if (landed.target === "question") {
      const live = questionMirror.current;
      const matches = Boolean(live && (live.requestId === route.requestId || live.id === route.requestId));
      if (!matches) {
        rememberQuestion({
          id: `push-${route.requestId}`,
          sessionId: route.sessionId,
          requestId: route.requestId,
          text: route.body || route.title || "Question",
          resolvedLabel: landed.resolved ? "Resolved" : null,
        });
      }
    }
  }

  function applyEvent(event: GatewayEvent) {
    if (event.seq !== null && event.sessionId) {
      seqs.current[event.sessionId] = Math.max(seqs.current[event.sessionId] ?? 0, event.seq);
    }
    if (event.type === "request.cancel") {
      forgetApproval(String(event.payload.id ?? ""), String(event.payload.reason ?? ""));
      return;
    }
    if (event.type === "approval.cancelled") {
      const ids = Array.isArray(event.payload.request_ids) ? event.payload.request_ids : [];
      for (const id of ids) {
        forgetApproval(String(id), null);
      }
      return;
    }
    const live = liveRef.current;
    if (event.sessionId && live && event.sessionId !== live) {
      return;
    }
    if (event.type === "message.delta") {
      const chunk = String(event.payload.text ?? "");
      if (!chunk || chunk === "null") {
        return;
      }
      commitLines((current) => {
        const next = current.slice();
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, text: last.text + chunk };
        } else {
          next.push(blankLine("assistant", chunk));
        }
        return next;
      });
    } else if (event.type === "message.complete") {
      const text = String(event.payload.text ?? "");
      const failed = event.payload.status === "error";
      const body = text || String(event.payload.error ?? "Reply finished");
      const messageId = messageIdFrom(event.payload);
      commitLines((current) => {
        const next = current.slice();
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            role: failed ? "error" : "assistant",
            text: body,
            messageId: messageId || last.messageId,
            seq: event.seq,
          };
        } else {
          next.push(blankLine(failed ? "error" : "assistant", body, messageId, event.seq));
        }
        return next;
      });
      setStatus(failed ? "Reply failed" : "Connected");
      void hidden().then((away) => {
        if (away) {
          notify(
            failed ? "Hermes error" : "Reply finished",
            body.slice(0, 180),
            routeFrom(failed ? "error" : "reply", failed ? "Hermes error" : "Reply finished", body.slice(0, 700), event.sessionId, "", messageId, event.seq),
          );
        }
      });
    } else if (event.type === "error") {
      const text = String(event.payload.message ?? event.payload.text ?? "Error");
      commitLines((current) => current.concat(blankLine("error", text, "", event.seq)));
      setStatus("Error");
      void hidden().then((away) => {
        if (away) {
          notify("Hermes error", text.slice(0, 180), routeFrom("error", "Hermes error", text.slice(0, 700), event.sessionId, "", "", event.seq));
        }
      });
    }
  }

  function applyRequest(request: ServerRequest) {
    if (request.method === "clarify") {
      if (!holdsQuestion(request)) {
        clientRef.current?.decline(request.id);
        return;
      }
      const questions = Array.isArray(request.params.questions) ? request.params.questions : [];
      const first = questions[0] && typeof questions[0] === "object" ? (questions[0] as Record<string, unknown>) : {};
      const text = String(first.question || "Question");
      const qid = String(first.qid || request.id);
      rememberQuestion({
        id: request.id,
        sessionId: String(request.params.session_id ?? ""),
        requestId: qid,
        text,
        resolvedLabel: null,
      });
      return;
    }
    if (request.method !== "approval") {
      clientRef.current?.decline(request.id);
      return;
    }
    if (resolvedIds.current.has(request.id) || answeredHere.current.has(request.id)) {
      return;
    }
    const card: Approval = {
      id: request.id,
      sessionId: String(request.params.session_id ?? ""),
      requestId: String(request.params.request_id ?? ""),
      description: String(request.params.description || "Approval needed"),
      command: String(request.params.command ?? ""),
      resolvedLabel: null,
    };
    if (approvalMirror.current?.id !== card.id) {
      rememberApproval(card);
    }
    setShowCommand(false);
    void clientRef.current?.noteApprovalVisible(card.sessionId, card.requestId).catch(() => undefined);
    void hidden().then((away) => {
      if (away) {
        notify(
          "Approval waiting",
          card.description,
          routeFrom("approval", "Approval waiting", card.description, card.sessionId, card.requestId || card.id, "", null),
        );
      }
    });
  }

  function bind(client: HermesClient) {
    client.onEvent = applyEvent;
    client.onServerRequest = applyRequest;
    client.onSocketClose = () => {
      if (!closing.current) {
        setReconnecting(true);
        setConnected(false);
        setStatus("Reconnecting");
        void reconnect();
      }
    };
  }

  async function openClient(url: string, material: LoginMaterial) {
    closing.current = true;
    clientRef.current?.close();
    closing.current = false;
    const client = new HermesClient({ serverUrl: url, http: tauriHttp(), socket: tauriSocket() });
    bind(client);
    const ready = await client.connect(material.accessToken);
    clientRef.current = client;
    materialRef.current = material;
    await invoke("vault_save", {
      payload: JSON.stringify({
        username: material.username,
        refreshToken: material.refreshToken,
        provider: material.provider,
      }),
    });
    setConnected(true);
    setReconnecting(false);
    setUsername(material.username);
    setPassword("");
    setStatus(ready.sessionAuthority ? "Connected (session authority)" : "Connected");
    const [nextProfiles, nextSessions] = await Promise.all([client.listProfiles(), client.listSessions()]);
    setProfiles(nextProfiles);
    setSessions(nextSessions);
    const route = pendingRoute.current;
    const live = liveRef.current;
    if (route?.sessionId && route.sessionId !== live) {
      await openSession(route.sessionId, route.profile);
    } else if (live) {
      const replay = await client.replay(live, seqs.current[live] ?? 0);
      syncOpenApprovals(replay.openRequests);
      if (replay.truncated) {
        await openSession(live);
      } else if (route && (!route.sessionId || route.sessionId === live)) {
        pendingRoute.current = null;
        placeFocus(route, replay.openRequests, linesRef.current);
      }
    } else if (route?.sessionId) {
      await openSession(route.sessionId, route.profile);
    }
  }

  async function restore(saved: Vault, url: string): Promise<boolean> {
    setStatus("Signing in");
    const probe = new HermesClient({ serverUrl: url, http: tauriHttp(), socket: tauriSocket() });
    try {
      const material = await probe.refresh({
        username: saved.username,
        refreshToken: saved.refreshToken,
        provider: saved.provider,
      });
      await openClient(url, material);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refresh failed";
      if (error instanceof HermesError && error.status === 401) {
        materialRef.current = null;
        await invoke("vault_clear_secret").catch(() => undefined);
        setReconnecting(false);
        setStatus(`Sign in again. ${message}`);
      } else {
        setStatus(message);
      }
      setUsername(saved.username);
      setConnected(false);
      return false;
    } finally {
      probe.close();
    }
  }

  async function reconnect() {
    const material = materialRef.current;
    const url = localStorage.getItem(SERVER_KEY) || serverUrl;
    if (!material?.refreshToken) {
      setReconnecting(false);
      setStatus("Sign in again");
      return;
    }
    let wait = 1000;
    for (;;) {
      const saved = materialRef.current;
      if (!saved?.refreshToken) {
        setReconnecting(false);
        return;
      }
      const ok = await restore(saved, url);
      if (ok) {
        return;
      }
      if (!materialRef.current?.refreshToken) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
      wait = Math.min(wait * 2, 15000);
    }
  }

  async function login() {
    const url = serverUrl.trim().replace(/\/+$/, "");
    localStorage.setItem(SERVER_KEY, url);
    setServerUrl(url);
    setStatus("Signing in");
    const typed = password;
    setPassword("");
    const probe = new HermesClient({ serverUrl: url, http: tauriHttp(), socket: tauriSocket() });
    try {
      const material = await probe.login(username.trim(), typed);
      await openClient(url, material);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed");
      setConnected(false);
    } finally {
      probe.close();
    }
  }

  async function openSession(sessionId: string, profile = "") {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    rememberQuestion(null);
    try {
      const opened = await client.resumeSession(sessionId, profile || undefined);
      const history = await client.history(opened.sessionId);
      const next = history.map((row) => blankLine(row.role || "assistant", row.text, row.rowId));
      liveRef.current = opened.sessionId;
      linesRef.current = next;
      setLiveId(opened.sessionId);
      setLines(next);
      syncOpenApprovals(opened.openRequests);
      setStatus("Connected");
      const route = pendingRoute.current;
      if (route && (!route.sessionId || route.sessionId === opened.sessionId)) {
        pendingRoute.current = null;
        placeFocus(route, opened.openRequests, next);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open the session");
    }
  }

  async function newSession() {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    try {
      const id = await client.createSession();
      liveRef.current = id;
      setLiveId(id);
      linesRef.current = [];
      setLines([]);
      rememberQuestion(null);
      setFocus(null);
      setSessions(await client.listSessions());
      setStatus("New session");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create a session");
    }
  }

  async function send() {
    const client = clientRef.current;
    const session = liveRef.current;
    const text = draft.trim();
    if (!client || !session || !text) {
      return;
    }
    setDraft("");
    commitLines((current) => current.concat(blankLine("user", text)));
    setStatus("Sending");
    try {
      await client.submit(session, text);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Send failed");
    }
  }

  async function answer(choice: "once" | "deny") {
    const card = approvalMirror.current;
    const client = clientRef.current;
    if (!card || card.resolvedLabel || !client) {
      return;
    }
    answeredHere.current.add(card.id);
    resolvedIds.current.add(card.id);
    try {
      await client.answerApproval(card.sessionId, card.requestId, choice);
      if (approvalMirror.current?.id === card.id) {
        rememberApproval(null);
      }
      setShowCommand(false);
      setStatus(choice === "deny" ? "Denied" : "Allowed once");
    } catch (error) {
      answeredHere.current.delete(card.id);
      resolvedIds.current.delete(card.id);
      setStatus(error instanceof Error ? error.message : "Approval failed");
    }
  }

  function stageFile(file: File) {
    if (file.size > 8_000_000) {
      setStatus("That file is over 8 MB. It was not staged.");
      return;
    }
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === "string" ? reader.result : null;
        setStaged((current) => current.concat({ name: file.name || "image", url }));
      };
      reader.readAsDataURL(file);
      return;
    }
    setStaged((current) => current.concat({ name: file.name || "file", url: null }));
  }

  async function toggleAutostart() {
    try {
      if (autostart) {
        await disable();
        setAutostart(false);
      } else {
        await enable();
        setAutostart(true);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Autostart failed");
    }
  }

  revealRef.current = (route) => {
    void (async () => {
      const window = getCurrentWindow();
      await window.show();
      await window.unminimize();
      await window.setFocus();
    })();
    if (!route) {
      return;
    }
    pendingRoute.current = route;
    if (!clientRef.current) {
      return;
    }
    if (route.sessionId && liveRef.current !== route.sessionId) {
      void openSession(route.sessionId, route.profile);
      return;
    }
    const transcript = linesRef.current;
    pendingRoute.current = null;
    placeFocus(route, liveOpenRequests(), transcript);
  };

  function lineLanded(index: number, line: Line): boolean {
    if (focus?.target !== "message") {
      return false;
    }
    if (focus.messageIndex === index) {
      return true;
    }
    if (focus.messageId && line.messageId && focus.messageId === line.messageId) {
      return true;
    }
    return focus.seq !== null && line.seq === focus.seq;
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex items-end justify-between gap-4 px-4 pt-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-black tracking-wide">HERMES BOTS</h1>
          <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">{status}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void toast("Hermes Bots", "Test toast from the phase 0 app")}>
            Send test toast
          </Button>
          <Button type="button" onClick={() => void toggleAutostart()}>
            {autostart ? "Autostart on" : "Autostart off"}
          </Button>
        </div>
      </header>
      {reconnecting ? (
        <div className="mx-4 mt-3 bg-primary px-3 py-2 font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary-foreground uppercase">
          Reconnecting
        </div>
      ) : null}
      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {connected ? (
          <>
            <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">Profiles</p>
            {profiles.map((profile) => (
              <p key={profile.name}>
                {profile.displayName} <span className="text-muted-foreground">{profile.model}</span>
                {profile.description ? <span className="block text-muted-foreground">{profile.description}</span> : null}
              </p>
            ))}
            <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">Sessions</p>
            <Button type="button" onClick={() => void newSession()}>
              New session
            </Button>
            <div className="flex flex-wrap gap-2">
              {sessions.map((session) => (
                <Button key={session.id} type="button" onClick={() => void openSession(session.id)}>
                  {session.title || session.id}
                </Button>
              ))}
            </div>
            {lines.map((line, index) => (
              <article
                key={`${index}-${line.role}-${line.messageId}`}
                ref={(node) => {
                  lineRefs.current[index] = node;
                }}
                className={lineLanded(index, line) ? "landed" : undefined}
              >
                <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
                  {line.role}
                </p>
                {line.role === "assistant" ? (
                  <Reply text={line.text} />
                ) : line.role === "user" ? (
                  <UserLine text={line.text} />
                ) : (
                  <p className={line.role === "error" ? "text-[var(--error)]" : undefined}>{line.text}</p>
                )}
              </article>
            ))}
            {approval ? (
              <section
                ref={approvalRef}
                className={
                  focus?.target === "approval" &&
                  (!focus.requestId || focus.requestId === approval.requestId || focus.requestId === approval.id)
                    ? "landed border border-primary p-3"
                    : "border border-primary p-3"
                }
              >
                <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">Needs you</p>
                <p>{approval.description}</p>
                {approval.resolvedLabel ? (
                  <p className="mt-2 font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">
                    {approval.resolvedLabel}
                  </p>
                ) : (
                  <>
                    {showCommand ? <pre className="font-mono text-sm text-muted-foreground">{approval.command}</pre> : null}
                    <div className="mt-2 flex gap-2">
                      <Button type="button" onClick={() => void answer("once")}>
                        Allow once
                      </Button>
                      <Button type="button" onClick={() => void answer("deny")}>
                        Deny
                      </Button>
                      <Button type="button" onClick={() => setShowCommand((value) => !value)}>
                        {showCommand ? "Hide command" : "Full command"}
                      </Button>
                    </div>
                  </>
                )}
              </section>
            ) : null}
            {question ? (
              <section
                ref={questionRef}
                className={
                  focus?.target === "question" &&
                  (!focus.requestId || focus.requestId === question.requestId || focus.requestId === question.id)
                    ? "landed border border-primary p-3"
                    : "border border-primary p-3"
                }
              >
                <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">Question</p>
                <p>{question.text}</p>
                {question.resolvedLabel ? (
                  <p className="mt-2 font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">
                    {question.resolvedLabel}
                  </p>
                ) : null}
              </section>
            ) : null}
          </>
        ) : (
          <form
            className="max-w-xl space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] uppercase">Hermes server</span>
              <Input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} autoCapitalize="off" spellCheck={false} />
            </label>
            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] uppercase">Username</span>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="off" spellCheck={false} />
            </label>
            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] uppercase">Password</span>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <Button type="submit">Log in</Button>
            <p className="text-sm text-muted-foreground">
              The password is used once. The refresh token is what gets stored, in Windows Credential Manager. Closing the window
              hides it to the tray. Quit is on the tray menu.
            </p>
          </form>
        )}
      </main>
      {connected ? (
        <form
          className="space-y-2 border-t border-[var(--line)] px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {staged.map((file) => (
            <div key={file.name} className="flex items-center gap-2">
              {file.url ? <img src={file.url} alt="" className="h-16 w-16 object-cover" /> : null}
              <span className="font-mono text-sm text-muted-foreground">{file.name}</span>
            </div>
          ))}
          <Textarea
            value={draft}
            aria-label="Message"
            placeholder="Message"
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files);
              const image = files.find((file) => file.type.startsWith("image/"));
              if (image) {
                event.preventDefault();
                stageFile(image);
              }
            }}
          />
          <div className="flex gap-2">
            <Button type="submit">Send</Button>
            <Button type="button" onClick={() => fileRef.current?.click()}>
              Attach file
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  stageFile(file);
                }
                event.target.value = "";
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">A thumbnail stays on this machine. This build does not upload it.</p>
        </form>
      ) : null}
      <div className="space-y-1 px-4 pb-4">
        <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
          Try Tamil and Hindi typing here
        </p>
        <Input value={ime} onChange={(event) => setIme(event.target.value)} aria-label="Try Tamil and Hindi typing here" />
      </div>
    </div>
  );
}
