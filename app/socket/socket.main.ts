import WebSocket from "ws";
import {
  handleCancelOrderResponse,
  handleErrors,
  handlePlaceOrderResponse,
} from "./socket.responses";
import { sessionService } from "../session/session.service";
const { reconnectUserSocket } = sessionService;
const socketMap = new Map<string, WebSocket>();
const lastPingMap = new Map<string, number>();

export function getBinanceSocket(sessionId: string): WebSocket | null {
  return socketMap.get(sessionId) || null;
}

export function initializeBinanceSocket(sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://ws-api.binance.com:443/ws-api/v3");

    ws.on("open", () => {
      socketMap.set(sessionId, ws);
      lastPingMap.set(sessionId, Date.now());
      resolve();
    });

    ws.on("ping", (data) => {
      lastPingMap.set(sessionId, Date.now());
      ws.pong(data);
    });

    ws.on("close", () => {
      console.warn(`⚠️ WebSocket fechado para sessão ${sessionId}`);
      socketMap.delete(sessionId);
      lastPingMap.delete(sessionId);
      reconnectUserSocket(sessionId);
    });

    ws.on("error", (err) => {
      console.error(`❌ Erro WebSocket para sessão ${sessionId}`, err);
      socketMap.delete(sessionId);
      lastPingMap.delete(sessionId);
      reject(err);
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(msg);
        if (msg.error) {
          handleErrors(msg);
        } else if (msg.id) {
          handlePlaceOrderResponse(msg);
        } else if (msg?.event?.e === "executionReport") {
          if (msg?.event?.X === "CANCELED") {
            handleCancelOrderResponse(msg.event);
          }
        } else {
          console.log(`📩 (${sessionId}) [OUTRO EVENTO]`, msg);
        }
      } catch (err) {
        console.log(`📩 (${sessionId}) [ERRO PARSE]`, data.toString());
      }
    });
  });
}

let monitorStarted = false;

export function startPingMonitor() {
  if (monitorStarted) return;
  monitorStarted = true;

  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, lastPing] of lastPingMap.entries()) {
      const diff = now - lastPing;
      if (diff > 60000) {
        console.warn(
          `⏱️ Ping timeout detectado para sessão ${sessionId} (${diff}ms)`
        );
        const socket = getBinanceSocket(sessionId);
        if (socket) {
          socket.terminate();
        }
        socketMap.delete(sessionId);
        lastPingMap.delete(sessionId);
        reconnectUserSocket(sessionId);
      }
    }
  }, 60_000);

  console.log("🛰️ Ping monitor iniciado");
}
