export type Message =
  | { type: "Text"; data: string }
  | { type: "Binary"; data: number[] }
  | { type: "Ping"; data: number[] }
  | { type: "Pong"; data: number[] }
  | { type: "Close"; data?: { code?: number; reason?: string } };

type Listener = (message: Message) => void;

class Socket {
  private listener: Listener | null = null;
  private listening = false;
  private readonly pending: Message[] = [];

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      this.push({ type: "Text", data: String(event.data) });
    });
    socket.addEventListener("close", (event) => {
      this.push({ type: "Close", data: { code: event.code, reason: event.reason } });
    });
  }

  private push(message: Message): void {
    if (this.listener) {
      this.listener(message);
      return;
    }
    if (!this.listening) {
      this.pending.push(message);
    }
  }

  addListener(handler: Listener): () => void {
    this.listening = true;
    this.listener = handler;
    const queued = this.pending.splice(0);
    for (const message of queued) {
      handler(message);
    }
    return () => {
      if (this.listener === handler) {
        this.listener = null;
        this.listening = false;
      }
    };
  }

  async send(data: string): Promise<void> {
    this.socket.send(data);
  }

  async disconnect(): Promise<void> {
    this.socket.close();
  }
}

export default class WebSocketShim {
  static async connect(url: string): Promise<Socket> {
    const socket = new WebSocket(url);
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
    });
    const wrapped = new Socket(socket);
    await opened;
    return wrapped;
  }
}
