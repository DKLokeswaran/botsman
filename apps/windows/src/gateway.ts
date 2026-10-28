import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import WebSocket, { type Message } from "@tauri-apps/plugin-websocket";
import {
  splitCombinedSetCookie,
  type Header,
  type HttpTransport,
  type SocketClose,
  type SocketTransport,
} from "@hermes-bots/gateway-client";

function headerList(response: Response): Header[] {
  const headers: Header[] = [];
  const getter = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof getter.getSetCookie === "function" ? getter.getSetCookie() : [];
  if (cookies.length > 0) {
    for (const value of cookies) {
      headers.push({ name: "set-cookie", value });
    }
  } else {
    const combined = response.headers.get("set-cookie");
    if (combined) {
      for (const value of splitCombinedSetCookie(combined)) {
        headers.push({ name: "set-cookie", value });
      }
    }
  }
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") {
      return;
    }
    headers.push({ name, value });
  });
  return headers;
}

/** Hermes HTTP goes through Tauri's native client. The webview origin is not localhost. */
export function tauriHttp(): HttpTransport {
  return {
    async request(input) {
      const response = await nativeFetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        // Do not follow redirects. A 302 from password-login can carry Set-Cookie,
        // and following it would present the next response, which does not.
        maxRedirections: 0,
        connectTimeout: 20_000,
      });
      return {
        status: response.status,
        headers: headerList(response),
        body: await response.text(),
      };
    },
  };
}

/** Hermes WebSocket goes through the native plugin so the Origin host matches the server. */
export function tauriSocket(): SocketTransport {
  let socket: Awaited<ReturnType<typeof WebSocket.connect>> | null = null;
  let onData: (data: string) => void = () => undefined;
  let onGone: (info: SocketClose) => void = () => undefined;
  let unlisten: (() => void) | null = null;

  return {
    onMessage(handler) {
      onData = handler;
    },
    onClose(handler) {
      onGone = handler;
    },
    async connect(url) {
      socket = await WebSocket.connect(url);
      unlisten = socket.addListener((message: Message) => {
        if (message.type === "Text") {
          onData(message.data);
          return;
        }
        if (message.type === "Close") {
          onGone({ code: message.data?.code, reason: message.data?.reason });
        }
      });
    },
    send(data) {
      if (!socket) {
        return;
      }
      return socket.send(data);
    },
    close() {
      const current = socket;
      socket = null;
      unlisten?.();
      unlisten = null;
      if (current) {
        void current.disconnect().catch(() => undefined);
      }
      onGone({});
    },
  };
}
