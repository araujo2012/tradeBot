import WebSocket from "ws";
import {
  handleErrors,
  handleExecutionReport,
  handlePlaceOrderResponse,
  handleReplaceOrderResponse,
} from "./socket.responses";
import { sessionService } from "../session/session.service";
import { WebsocketDataModel } from "../../models/websocketData";
const { reconnectUserSocket } = sessionService;
const socketMap = new Map<string, WebSocket>();
const lastPingMap = new Map<string, number>();
const reconnectingMap = new Set<string>();
const retryCountMap = new Map<string, number>();

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
      //lastPingMap.set(sessionId, Date.now());
      ws.pong(data);
    });

    ws.on("close", () => {
      handleSocketFailure(sessionId, "close");
    });

    ws.on("error", (err) => {
      console.error(`❌ WebSocket erro ${sessionId}`, err);
    });

    ws.on("message", (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        WebsocketDataModel.create({
          sessionId,
          type: "received",
          payload: msg,
        });
        if (msg?.id && msg?.status === 200 && msg?.result?.status === "NEW") {
          handlePlaceOrderResponse(msg);
        } else if (msg?.event?.e === "outboundAccountPosition") {
        } else if (msg?.event?.e === "executionReport") {
          handleExecutionReport(msg);
        } else {
          console.log("socket", msg);
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
      if (now - lastPing > 90_000) {
        handleSocketFailure(sessionId, "ping-timeout");
      }
    }
  }, 30_000);

  console.log("🛰️ Ping monitor iniciado");
}

async function handleSocketFailure(sessionId: string, reason: string) {
  const delay = getBackoffDelay(sessionId);
  setTimeout(() => reconnectUserSocket(sessionId), delay);
  if (reconnectingMap.has(sessionId)) {
    console.warn(`🔁 Reconexão já em andamento: ${sessionId}`);
    return;
  }

  reconnectingMap.add(sessionId);

  console.warn(`♻️ Reconectando sessão ${sessionId} | Motivo: ${reason}`);

  const socket = socketMap.get(sessionId);
  if (socket) {
    try {
      socket.terminate();
    } catch {}
  }

  socketMap.delete(sessionId);
  lastPingMap.delete(sessionId);

  await reconnectUserSocket(sessionId);

  reconnectingMap.delete(sessionId);
}

function getBackoffDelay(sessionId: string) {
  const retry = retryCountMap.get(sessionId) || 0;
  retryCountMap.set(sessionId, retry + 1);
  return Math.min(30_000, 2 ** retry * 1000);
}
