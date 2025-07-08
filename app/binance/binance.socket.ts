import * as WebSocket from "ws";

const socketMap: Record<string, WebSocket.WebSocket> = {};

export function startBinanceSocket(
  listenKey: string,
  username: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket.WebSocket(
      `wss://stream.binance.com:9443/ws/${listenKey}`
    );

    ws.on("open", () => {
      console.log(`[${username}] WebSocket aberto.`);
      socketMap[username] = ws;
      resolve();
    });

    ws.on("message", (data: WebSocket.RawData) => {
      console.log(`[${username}] Mensagem recebida:`, data.toString());
    });

    ws.on("close", () => {
      console.log(`[${username}] WebSocket fechado.`);
    });

    ws.on("error", (err: Error) => {
      console.error(`[${username}] Erro no WebSocket:`, err);
      reject(new Error(`Erro ao conectar WebSocket: ${err.message}`));
    });
  });
}
