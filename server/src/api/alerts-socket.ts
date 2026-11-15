import { AlertsClientMessage, type AlertsServerMessage } from "@botsman/protocol";
import { compile } from "@earendil-works/pi-schema";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { ALERTS_STREAM, type Services } from "../services.ts";

const checkMessage = compile(AlertsClientMessage);

// The small alerts stream for background connections: the tray on Windows and the foreground service on Android.
// After a reconnect it replays missed alerts, or sends `reset` when it can't, so the app refetches what needs the owner.
export function registerAlertsSocket(app: FastifyInstance, services: Services): void {
  app.get("/api/alerts", { websocket: true, config: { public: true } }, (raw) => {
    const socket = raw as unknown as WebSocket;
    let unsubscribe: (() => void) | undefined;
    const send = (message: AlertsServerMessage) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(message));
    socket.on("close", () => unsubscribe?.());
    socket.on("message", (data) => {
      const message = parse(String(data));
      if (message === undefined) return send({ type: "error", error: "bad_request", message: "Unknown message" });
      if (message.type === "ping") return send({ type: "pong" });
      if (!signedIn(services, message.token)) {
        send({ type: "error", error: "unauthorized", message: "Access token is not valid" });
        return socket.close(4001, "unauthorized");
      }
      unsubscribe?.();
      const { alerts } = services;
      const missed = alerts.since(ALERTS_STREAM, message.epoch, message.seq);
      if (missed === undefined) send({ type: "reset", epoch: alerts.epoch, seq: alerts.currentSeq(ALERTS_STREAM) });
      for (const item of missed ?? []) send({ type: "alert", epoch: alerts.epoch, seq: item.seq, alert: item.event });
      unsubscribe = alerts.subscribe(ALERTS_STREAM, (item) => send({ type: "alert", epoch: alerts.epoch, seq: item.seq, alert: item.event }));
    });
  });
}

function signedIn(services: Services, token: string): boolean {
  try {
    services.auth.verifyAccess(token);
    return true;
  } catch {
    return false;
  }
}

function parse(text: string): AlertsClientMessage | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return checkMessage.check(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
