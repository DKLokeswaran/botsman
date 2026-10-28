import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  HermesClient,
  HermesError,
  type GatewayEvent,
  type LoginMaterial,
  type ProfileRow,
  type ServerRequest,
  type SessionRow,
} from "@hermes-bots/gateway-client";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
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

type Line = { role: string; text: string };
type Approval = {
  id: string;
  sessionId: string;
  requestId: string;
  description: string;
  command: string;
};
type Staged = { name: string; url: string | null };
type Vault = { username: string; refreshToken: string; provider: string };

async function toast(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({ title, body });
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

  useEffect(() => {
    liveRef.current = liveId;
  }, [liveId]);

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

  function applyEvent(event: GatewayEvent) {
    if (event.seq !== null && event.sessionId) {
      seqs.current[event.sessionId] = Math.max(seqs.current[event.sessionId] ?? 0, event.seq);
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
      setLines((current) => {
        const next = current.slice();
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { role: "assistant", text: last.text + chunk };
        } else {
          next.push({ role: "assistant", text: chunk });
        }
        return next;
      });
    } else if (event.type === "message.complete") {
      const text = String(event.payload.text ?? "");
      const failed = event.payload.status === "error";
      const body = text || String(event.payload.error ?? "Reply finished");
      setLines((current) => {
        const next = current.slice();
        if (next[next.length - 1]?.role === "assistant") {
          next[next.length - 1] = { role: failed ? "error" : "assistant", text: body };
        } else {
          next.push({ role: failed ? "error" : "assistant", text: body });
        }
        return next;
      });
      setStatus(failed ? "Reply failed" : "Connected");
      void hidden().then((away) => {
        if (away) {
          void toast("Hermes Bots", body.slice(0, 180));
        }
      });
    } else if (event.type === "error") {
      const text = String(event.payload.message ?? event.payload.text ?? "Error");
      setLines((current) => current.concat({ role: "error", text }));
      setStatus("Error");
    }
  }

  function applyRequest(request: ServerRequest) {
    if (request.method !== "approval") {
      clientRef.current?.decline(request.id);
      return;
    }
    const card: Approval = {
      id: request.id,
      sessionId: String(request.params.session_id ?? ""),
      requestId: String(request.params.request_id ?? ""),
      description: String(request.params.description || "Approval needed"),
      command: String(request.params.command ?? ""),
    };
    setApproval((current) => (current?.id === card.id ? current : card));
    setShowCommand(false);
    void clientRef.current?.noteApprovalVisible(card.sessionId, card.requestId).catch(() => undefined);
    void hidden().then((away) => {
      if (away) {
        void toast("Hermes Bots", card.description);
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
    const live = liveRef.current;
    if (live) {
      const replay = await client.replay(live, seqs.current[live] ?? 0);
      if (replay.truncated) {
        await openSession(live);
      }
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

  async function openSession(sessionId: string) {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    try {
      const opened = await client.resumeSession(sessionId);
      const history = await client.history(opened.sessionId);
      liveRef.current = opened.sessionId;
      setLiveId(opened.sessionId);
      setLines(history.map((row) => ({ role: row.role || "assistant", text: row.text })));
      setStatus("Connected");
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
      setLines([]);
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
    setLines((current) => current.concat({ role: "user", text }));
    setStatus("Sending");
    try {
      await client.submit(session, text);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Send failed");
    }
  }

  function answer(choice: "once" | "deny") {
    if (!approval) {
      return;
    }
    clientRef.current?.respond(approval.id, { choice });
    setApproval(null);
    setShowCommand(false);
    setStatus(choice === "deny" ? "Denied" : "Allowed once");
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
            {approval ? (
              <section className="border border-primary p-3">
                <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-primary uppercase">Needs you</p>
                <p>{approval.description}</p>
                {showCommand ? <pre className="font-mono text-sm text-muted-foreground">{approval.command}</pre> : null}
                <div className="mt-2 flex gap-2">
                  <Button type="button" onClick={() => answer("once")}>
                    Allow once
                  </Button>
                  <Button type="button" onClick={() => answer("deny")}>
                    Deny
                  </Button>
                  <Button type="button" onClick={() => setShowCommand((value) => !value)}>
                    {showCommand ? "Hide command" : "Full command"}
                  </Button>
                </div>
              </section>
            ) : null}
            {lines.map((line, index) => (
              <article key={`${index}-${line.role}`}>
                <p className="font-[family-name:var(--font-label)] text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
                  {line.role}
                </p>
                {line.role === "assistant" ? (
                  <div className="reply">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{line.text || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  <p className={line.role === "error" ? "text-[var(--error)]" : undefined}>{line.text}</p>
                )}
              </article>
            ))}
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
