import WebSocket from "ws";

let socketInstance: WebSocket | null = null;

export function getBinanceSocket(): WebSocket | null {
  return socketInstance;
}

export function initializeBinanceSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://ws-api.binance.com:443/ws-api/v3");

    ws.on("open", () => {
      // Auth e demais configs
      socketInstance = ws;
      console.log("✅ WebSocket conectado");
      resolve();
    });

    ws.on("close", () => {
      console.warn("⚠️ WebSocket fechado");
      socketInstance = null;
    });

    ws.on("error", (err) => {
      console.error("❌ Erro WebSocket", err);
      reject(err);
    });

    ws.on("message", (data) => {
      console.log("📩", data.toString());
    });
  });
}
