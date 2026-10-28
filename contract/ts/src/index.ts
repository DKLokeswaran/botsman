/**
 * Thin Hermes v0.22.5 gateway client.
 *
 * Written from contract/gateway-contract.openrpc.json. It is not a copy of
 * the Hermes apps/shared client. HTTP and the socket are injected so the
 * Windows app can use Tauri's native plugins and the tests can use Node.
 */

import { parseRetryAfterSeconds } from "./attach.ts";

export interface Header {
  name: string;
  value: string;
}

export interface HttpResponse {
  status: number;
  headers: Header[];
  body: string;
}

export interface HttpTransport {
  request(input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<HttpResponse>;
}

export interface SocketClose {
  code?: number;
  reason?: string;
}

export interface SocketTransport {
  connect(url: string): Promise<void>;
  send(data: string): void | Promise<void>;
  close(): void;
  onMessage(handler: (data: string) => void): void;
  onClose(handler: (info: SocketClose) => void): void;
}

export interface LoginMaterial {
  username: string;
  accessToken: string;
  refreshToken: string;
  provider: string;
  expiresAt: number | null;
}

export interface GatewayEvent {
  type: string;
  sessionId: string;
  seq: number | null;
  payload: Record<string, unknown>;
}

export interface ServerRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface ReadyInfo {
  replayEpoch: string;
  heartbeat: boolean;
  sessionAuthority: boolean;
}

export interface ProfileRow {
  name: string;
  displayName: string;
  description: string;
  model: string;
  isDefault: boolean;
}

export interface SessionRow {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
}

export interface TranscriptMessage {
  role: string;
  text: string;
  rowId: string;
}

export {
  formatPush,
  openRequestIds,
  parsePush,
  routeFocus,
  type PushKind,
  type PushRequest,
  type PushRoute,
  type RouteFocus,
  type TrackedMessage,
} from "./push.ts";
export {
  isSessionAttachFailure,
  parseRetryAfterSeconds,
  reconnectDelayMs,
  RECONNECT_BACKOFF_CAP_MS,
  RESUME_RETRY_MS,
  SESSION_UNAVAILABLE_CODE,
  SESSION_UNAVAILABLE_NOTICE,
} from "./attach.ts";
export {
  formatAppVersion,
  parseLatest,
  updateAvailable,
  type LatestRelease,
  type ReleaseFile,
} from "./update.ts";

export interface ReplayResult {
  events: GatewayEvent[];
  latestSeq: number;
  truncated: boolean;
  epoch: string;
  openRequests: ServerRequest[];
}

export class HermesError extends Error {
  status: number | null;
  code: number | null;
  retryAfter: number | null;

  constructor(
    message: string,
    status: number | null = null,
    code: number | null = null,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "HermesError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const SECRET_QUERY = /((?:^|[\s?&])(?:ticket|token|access_token|refresh_token|password)=)[^&#\s"']*/gi;
const SECRET_JSON = /("(?:password|access_token|refresh_token|ticket|token)"\s*:\s*")[^"]*(")/gi;
const BEARER = /Bearer\s+\S+/gi;
const COOKIE_VALUE = /((?:__Host-|__Secure-)?hermes_session_[A-Za-z0-9_-]+)=[^;\s,]*/gi;
const USERINFO = /:\/\/[^/\s@]+:[^/\s@]+@/g;

/** Drop passwords, cookies, and tokens. The surrounding label stays so the failure is still readable. */
export function scrubSecrets(text: string): string {
  return text
    .replace(USERINFO, "://[redacted]@")
    .replace(BEARER, "Bearer [redacted]")
    .replace(COOKIE_VALUE, "$1=[redacted]")
    .replace(SECRET_QUERY, "$1[redacted]")
    .replace(SECRET_JSON, '$1[redacted]$2');
}

export function publicUrl(url: string): string {
  return scrubSecrets(url);
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return null;
}

function readDetail(body: string): string | null {
  try {
    const root = asRecord(JSON.parse(body));
    let text: string | null;
    if ("detail" in root && root.detail != null) {
      if (typeof root.detail === "string") {
        text = root.detail;
      } else {
        text = firstString(asRecord(root.detail), ["reason", "message"]);
      }
    } else {
      text = firstString(root, ["reason"]);
    }
    if (!text) {
      return null;
    }
    const trimmed = scrubSecrets(text).trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

/** `Login failed (401: Invalid credentials)`. */
export function httpFailureMessage(action: string, status: number, body: string): string {
  const detail = readDetail(body);
  return detail ? `${action} (${status}: ${detail})` : `${action} (${status})`;
}

/** Transport failure, including a scope error, DNS, connection refused, or a timeout, plus the URL. */
export function transportFailureMessage(action: string, url: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const reason = scrubSecrets(raw).trim() || "request failed";
  const safeUrl = publicUrl(url);
  if (reason.includes(safeUrl)) {
    return `${action}: ${reason}`;
  }
  return `${action}: ${reason} URL: ${safeUrl}`;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_DEADLINE_MS = 45_000;

/** Accept the bare cookie and the HTTPS `__Host-` / `__Secure-` variants. */
export function sessionCookie(headers: Header[], name: string): string | null {
  return (
    readSetCookie(headers, name) ??
    readSetCookie(headers, `__Host-${name}`) ??
    readSetCookie(headers, `__Secure-${name}`)
  );
}

/**
 * Split a combined Set-Cookie header. A comma starts a new cookie only when
 * the next token looks like a cookie name. Expires dates stay intact.
 */
export function splitCombinedSetCookie(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ",") {
      continue;
    }
    const rest = value.slice(index + 1);
    if (/^\s*[!#$%&'*+\-.0-9A-Z^_`a-z|~]+=/.test(rest)) {
      const piece = value.slice(start, index).trim();
      if (piece) {
        parts.push(piece);
      }
      start = index + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail) {
    parts.push(tail);
  }
  return parts;
}

export function readSetCookie(headers: Header[], name: string): string | null {
  for (const header of headers) {
    if (header.name.toLowerCase() !== "set-cookie") {
      continue;
    }
    const pair = header.value.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq < 0) {
      continue;
    }
    if (pair.slice(0, eq).trim() !== name) {
      continue;
    }
    return decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return null;
}

export function httpToWs(serverUrl: string, ticket: string): string {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/ws";
  url.search = "";
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function eventFromParams(params: Record<string, unknown>): GatewayEvent {
  const seq = params.seq;
  return {
    type: String(params.type ?? ""),
    sessionId: String(params.session_id ?? ""),
    seq: typeof seq === "number" ? seq : null,
    payload: asRecord(params.payload),
  };
}

function requestFromOpen(entry: unknown): ServerRequest | null {
  const row = asRecord(entry);
  if (typeof row.id !== "string" || typeof row.method !== "string") {
    return null;
  }
  return { id: row.id, method: row.method, params: asRecord(row.params) };
}

export class HermesClient {
  readonly serverUrl: string;
  private readonly http: HttpTransport;
  private readonly socket: SocketTransport;
  private readonly pending = new Map<string, Pending>();
  private nextId = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastLiveness = 0;
  private closedOnPurpose = false;
  private readyWait: { resolve: (info: ReadyInfo) => void; reject: (error: Error) => void } | null = null;
  private serverRequestWaiters: Array<(request: ServerRequest) => void> = [];
  private eventWaiters: Array<(event: GatewayEvent) => void> = [];

  onEvent: (event: GatewayEvent) => void = () => undefined;
  onServerRequest: (request: ServerRequest) => void = () => undefined;
  onSocketClose: (info: SocketClose) => void = () => undefined;

  constructor(options: { serverUrl: string; http: HttpTransport; socket: SocketTransport }) {
    this.serverUrl = options.serverUrl.replace(/\/+$/, "");
    this.http = options.http;
    this.socket = options.socket;
  }

  private async request(
    url: string,
    input: { method: string; url: string; headers?: Record<string, string>; body?: string },
    action: string,
  ): Promise<HttpResponse> {
    try {
      return await this.http.request(input);
    } catch (error) {
      throw new HermesError(transportFailureMessage(action, url, error));
    }
  }

  async login(username: string, password: string): Promise<LoginMaterial> {
    const url = `${this.serverUrl}/auth/password-login`;
    const response = await this.request(url, {
      method: "POST",
      url,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "basic", username, password, next: "/" }),
    }, "Login failed");
    const accessToken = sessionCookie(response.headers, "hermes_session_at");
    const refreshToken = sessionCookie(response.headers, "hermes_session_rt");
    const provider = sessionCookie(response.headers, "hermes_session_provider") ?? "basic";
    // A redirect is not followed. Cookies on that response still count, so Set-Cookie is not dropped.
    if (accessToken && refreshToken) {
      return { username, accessToken, refreshToken, provider, expiresAt: null };
    }
    if (response.status !== 200) {
      throw new HermesError(
        httpFailureMessage("Login failed", response.status, response.body),
        response.status,
        null,
        parseRetryAfterSeconds(response.headers),
      );
    }
    throw new HermesError("Login response did not include session cookies", response.status);
  }

  async refresh(material: Pick<LoginMaterial, "username" | "refreshToken" | "provider">): Promise<LoginMaterial> {
    const url = `${this.serverUrl}/auth/native/refresh`;
    const response = await this.request(url, {
      method: "POST",
      url,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: material.refreshToken, provider: material.provider }),
    }, "Refresh failed");
    if (response.status !== 200) {
      throw new HermesError(
        httpFailureMessage("Refresh failed", response.status, response.body),
        response.status,
        null,
        parseRetryAfterSeconds(response.headers),
      );
    }
    let body: Record<string, unknown>;
    try {
      body = asRecord(JSON.parse(response.body));
    } catch {
      throw new HermesError("Refresh response did not include tokens", response.status);
    }
    const accessToken = String(body.access_token ?? "");
    const refreshToken = String(body.refresh_token ?? "");
    if (!accessToken || !refreshToken) {
      throw new HermesError("Refresh response did not include tokens", response.status);
    }
    return {
      username: material.username,
      accessToken,
      refreshToken,
      provider: String(body.provider ?? material.provider),
      expiresAt: typeof body.expires_at === "number" ? body.expires_at : null,
    };
  }

  async ticket(accessToken: string): Promise<string> {
    const url = `${this.serverUrl}/api/auth/ws-ticket`;
    const response = await this.request(url, {
      method: "POST",
      url,
      headers: { authorization: `Bearer ${accessToken}` },
    }, "Could not mint a websocket ticket");
    if (response.status !== 200) {
      throw new HermesError(
        httpFailureMessage("Could not mint a websocket ticket", response.status, response.body),
        response.status,
      );
    }
    const body = asRecord(JSON.parse(response.body));
    const ticket = String(body.ticket ?? "");
    if (!ticket) {
      throw new HermesError("Ticket response was empty", response.status);
    }
    return ticket;
  }

  async connect(accessToken: string): Promise<ReadyInfo> {
    this.closedOnPurpose = false;
    const ticket = await this.ticket(accessToken);
    const ready = new Promise<ReadyInfo>((resolve, reject) => {
      this.readyWait = { resolve, reject };
    });
    this.socket.onMessage((data) => this.handleFrame(data));
    this.socket.onClose((info) => this.handleClose(info));
    await this.socket.connect(httpToWs(this.serverUrl, ticket));
    const info = await ready;
    await this.rpc("client.capabilities", { server_requests: true });
    if (info.heartbeat) {
      this.startHeartbeat();
    }
    return info;
  }

  async listProfiles(): Promise<ProfileRow[]> {
    const result = asRecord(await this.rpc("profiles.list", { include_sessions: true }));
    const rows = Array.isArray(result.profiles) ? result.profiles : [];
    return rows.map((row) => {
      const item = asRecord(row);
      return {
        name: String(item.name ?? ""),
        displayName: String(item.display_name || item.name || ""),
        description: String(item.description ?? ""),
        model: String(item.model ?? ""),
        isDefault: item.is_default === true,
      };
    });
  }

  async listSessions(profile?: string): Promise<SessionRow[]> {
    const result = asRecord(await this.rpc("session.list", profile ? { profile } : {}));
    const rows = Array.isArray(result.sessions) ? result.sessions : [];
    return rows.map((row) => {
      const item = asRecord(row);
      return {
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        preview: String(item.preview ?? ""),
        messageCount: typeof item.message_count === "number" ? item.message_count : 0,
      };
    });
  }

  async createSession(): Promise<string> {
    const result = asRecord(await this.rpc("session.create", {}));
    return String(result.session_id ?? "");
  }

  async resumeSession(
    sessionId: string,
    profile?: string,
  ): Promise<{ sessionId: string; messages: TranscriptMessage[]; openRequests: ServerRequest[] }> {
    const result = asRecord(
      await this.rpc("session.resume", {
        session_id: sessionId,
        omit_messages: false,
        inline_images: false,
        ...(profile ? { profile } : {}),
      }),
    );
    const openRequests = this.deliverOpenRequests(result.open_requests);
    return {
      sessionId: String(result.session_id || sessionId),
      messages: messagesFrom(result.messages),
      openRequests,
    };
  }

  async history(sessionId: string): Promise<TranscriptMessage[]> {
    const result = asRecord(await this.rpc("session.history", { session_id: sessionId }));
    return messagesFrom(result.messages);
  }

  async submit(sessionId: string, text: string): Promise<unknown> {
    return this.rpc("prompt.submit", { session_id: sessionId, text });
  }

  async replay(sessionId: string, lastSeen: number): Promise<ReplayResult> {
    const result = asRecord(
      await this.rpc("session.events.since", { session_id: sessionId, last_seen: lastSeen }),
    );
    const events = (Array.isArray(result.events) ? result.events : []).map((item) =>
      eventFromParams(asRecord(item)),
    );
    const openRequests = (Array.isArray(result.open_requests) ? result.open_requests : [])
      .map(requestFromOpen)
      .filter((item): item is ServerRequest => item !== null);
    for (const event of events) {
      this.publishEvent(event);
    }
    for (const request of openRequests) {
      this.publishRequest(request);
    }
    return {
      events,
      latestSeq: typeof result.latest_seq === "number" ? result.latest_seq : lastSeen,
      truncated: result.truncated === true,
      epoch: String(result.epoch ?? ""),
      openRequests,
    };
  }

  async noteApprovalVisible(sessionId: string, requestId: string): Promise<void> {
    await this.rpc("approval.received", { session_id: sessionId, request_id: requestId });
  }

  /** Settle an approval so Hermes emits request.cancel to every socket attached to the session. */
  async answerApproval(sessionId: string, requestId: string, choice: string): Promise<void> {
    const result = asRecord(
      await this.rpc("approval.respond", {
        session_id: sessionId,
        request_id: requestId,
        choice,
      }),
    );
    if (result.resolved === 0) {
      throw new HermesError("Approval was already resolved");
    }
  }

  /** Stop the live turn. Hermes drops pending approvals and emits approval.cancelled. */
  async interruptSession(sessionId: string): Promise<void> {
    await this.rpc("session.interrupt", { session_id: sessionId });
  }

  respond(id: string, result: Record<string, unknown>): void {
    void this.socket.send(JSON.stringify({ jsonrpc: "2.0", id, result }));
  }

  decline(id: string): void {
    this.respond(id, { value: "" });
  }

  close(): void {
    this.closedOnPurpose = true;
    this.stopHeartbeat();
    this.rejectAll(new HermesError("Connection closed"));
    this.socket.close();
  }

  waitForServerRequest(method: string, timeoutMs = 5000): Promise<ServerRequest> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new HermesError(`Timed out waiting for ${method}`)), timeoutMs);
      this.serverRequestWaiters.push((request) => {
        if (request.method === method) {
          clearTimeout(timer);
          resolve(request);
        }
      });
    });
  }

  waitForEvent(type: string, timeoutMs = 5000): Promise<GatewayEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new HermesError(`Timed out waiting for ${type}`)), timeoutMs);
      this.eventWaiters.push((event) => {
        if (event.type === type) {
          clearTimeout(timer);
          resolve(event);
        }
      });
    });
  }

  private async rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = `c${++this.nextId}`;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new HermesError(`${method} timed out`));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
    });
    await this.socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    return response;
  }

  private handleFrame(data: string): void {
    this.lastLiveness = Date.now();
    let frame: Record<string, unknown>;
    try {
      frame = asRecord(JSON.parse(data));
    } catch {
      return;
    }
    if (frame.method === "event") {
      const params = asRecord(frame.params);
      if (params.type === "gateway.ready") {
        const payload = asRecord(params.payload);
        const info: ReadyInfo = {
          replayEpoch: String(payload.replay_epoch ?? ""),
          heartbeat: payload.heartbeat === true,
          sessionAuthority: payload.session_authority === true,
        };
        this.readyWait?.resolve(info);
        this.readyWait = null;
      }
      this.publishEvent(eventFromParams(params));
      return;
    }
    if (typeof frame.method === "string" && (typeof frame.id === "string" || typeof frame.id === "number")) {
      this.publishRequest({
        id: String(frame.id),
        method: frame.method,
        params: asRecord(frame.params),
      });
      return;
    }
    if (frame.id !== undefined && ("result" in frame || "error" in frame)) {
      const pending = this.pending.get(String(frame.id));
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(String(frame.id));
      if ("error" in frame) {
        const error = asRecord(frame.error);
        pending.reject(
          new HermesError(String(error.message ?? "rpc error"), null, typeof error.code === "number" ? error.code : null),
        );
        return;
      }
      pending.resolve(frame.result);
    }
  }

  private publishEvent(event: GatewayEvent): void {
    this.onEvent(event);
    for (const waiter of this.eventWaiters) {
      waiter(event);
    }
  }

  private publishRequest(request: ServerRequest): void {
    this.onServerRequest(request);
    for (const waiter of this.serverRequestWaiters) {
      waiter(request);
    }
  }

  private deliverOpenRequests(value: unknown): ServerRequest[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const requests: ServerRequest[] = [];
    for (const entry of value) {
      const request = requestFromOpen(entry);
      if (request) {
        requests.push(request);
        this.publishRequest(request);
      }
    }
    return requests;
  }

  private handleClose(info: SocketClose): void {
    this.stopHeartbeat();
    this.readyWait?.reject(new HermesError("Socket closed before the handshake"));
    this.readyWait = null;
    this.rejectAll(new HermesError("Socket closed"));
    if (!this.closedOnPurpose) {
      this.onSocketClose(info);
    }
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastLiveness = Date.now();
    let lastPing = 0;
    let sequence = 0;
    this.heartbeat = setInterval(() => {
      const now = Date.now();
      if (lastPing > this.lastLiveness && now - this.lastLiveness >= HEARTBEAT_DEADLINE_MS) {
        this.socket.close();
        return;
      }
      lastPing = now;
      void this.socket.send(
        JSON.stringify({ jsonrpc: "2.0", id: `heartbeat-${++sequence}`, method: "gateway.ping", params: {} }),
      );
    }, HEARTBEAT_INTERVAL_MS);
    const timer = this.heartbeat as { unref?: () => void } | null;
    timer?.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }
}

function messagesFrom(value: unknown): TranscriptMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((row) => {
    const item = asRecord(row);
    const rowId = item.row_id;
    return {
      role: String(item.role ?? ""),
      text: String(item.text ?? ""),
      rowId: rowId === undefined || rowId === null ? "" : String(rowId),
    };
  });
}

export function nodeHttp(): HttpTransport {
  return {
    async request(input) {
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
      });
      const headers: Header[] = [];
      const cookies =
        typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
      for (const cookie of cookies) {
        headers.push({ name: "set-cookie", value: cookie });
      }
      response.headers.forEach((value, name) => {
        if (name.toLowerCase() !== "set-cookie") {
          headers.push({ name, value });
        }
      });
      return { status: response.status, headers, body: await response.text() };
    },
  };
}

export function nodeSocket(): SocketTransport {
  let ws: WebSocket | null = null;
  let onMessage: ((data: string) => void) | null = null;
  let onClose: ((info: SocketClose) => void) | null = null;
  const queued: string[] = [];
  return {
    connect(url: string) {
      return new Promise((resolve, reject) => {
        const sock = new WebSocket(url);
        ws = sock;
        sock.addEventListener("open", () => resolve());
        sock.addEventListener("error", () => reject(new HermesError("WebSocket connection failed")));
        sock.addEventListener("message", (event) => {
          const data = String(event.data);
          if (onMessage) {
            onMessage(data);
          } else {
            queued.push(data);
          }
        });
        sock.addEventListener("close", (event) => {
          onClose?.({ code: event.code, reason: event.reason });
        });
      });
    },
    send(data: string) {
      ws?.send(data);
    },
    close() {
      ws?.close();
    },
    onMessage(handler) {
      onMessage = handler;
      while (queued.length > 0) {
        handler(queued.shift() as string);
      }
    },
    onClose(handler) {
      onClose = handler;
    },
  };
}
