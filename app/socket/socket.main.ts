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

export function getBinanceSocket(userId: string): WebSocket | null {
  return socketMap.get(userId) || null;
}

export function initializeBinanceSocket(userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://ws-api.binance.com:443/ws-api/v3");

    ws.on("open", () => {
      socketMap.set(userId, ws);
      lastPingMap.set(userId, Date.now());
      console.log(`✅ WebSocket conectado para usuário ${userId}`);
      resolve();
    });

    ws.on("ping", (data) => {
      lastPingMap.set(userId, Date.now());
      ws.pong(data);
    });

    ws.on("close", () => {
      console.warn(`⚠️ WebSocket fechado para usuário ${userId}`);
      socketMap.delete(userId);
      lastPingMap.delete(userId);
      reconnectUserSocket(userId); // ✅ reconexão centralizada
    });

    ws.on("error", (err) => {
      console.error(`❌ Erro WebSocket para usuário ${userId}`, err);
      socketMap.delete(userId);
      lastPingMap.delete(userId);
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
          console.log(`📩 (${userId}) [OUTRO EVENTO]`, msg);
        }
      } catch (err) {
        console.log(`📩 (${userId}) [ERRO PARSE]`, data.toString());
      }
    });
  });
}

let monitorStarted = false;

export function startPingMonitor() {
  if (monitorStarted) return;
  monitorStarted = true;

  setInterval(async () => {
    const now = Date.now();
    for (const [userId, lastPing] of lastPingMap.entries()) {
      const diff = now - lastPing;
      if (diff > 60000) {
        console.warn(`⏱️ Ping timeout detectado para ${userId} (${diff}ms)`);
        const socket = getBinanceSocket(userId);
        if (socket) {
          socket.terminate();
        }
        socketMap.delete(userId);
        lastPingMap.delete(userId);
        reconnectUserSocket(userId);
      }
    }
  }, 60_000);

  console.log("🛰️ Ping monitor iniciado");
}
