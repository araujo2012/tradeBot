import WebSocket from "ws";

const socketMap = new Map<string, WebSocket>();

export function getBinanceSocket(userId: string): WebSocket | null {
  return socketMap.get(userId) || null;
}

export function initializeBinanceSocket(userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://ws-api.binance.com:443/ws-api/v3");

    ws.on("open", () => {
      socketMap.set(userId, ws);
      console.log(`✅ WebSocket conectado para usuário ${userId}`);
      resolve();
    });

    ws.on("close", () => {
      console.warn(`⚠️ WebSocket fechado para usuário ${userId}`);
      socketMap.delete(userId);
    });

    ws.on("error", (err) => {
      console.error(`❌ Erro WebSocket para usuário ${userId}`, err);
      socketMap.delete(userId);
      reject(err);
    });

    ws.on("message", (data) => {
      console.log(`📩 (${userId})`, data.toString());
    });
  });
}
