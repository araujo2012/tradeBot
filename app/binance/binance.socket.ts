import * as WebSocket from "ws";
import { getRabbitChannel } from "../lib/rabbit";

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

    ws.on("message", async (data: WebSocket.RawData) => {
      const message = data.toString();
      console.log(`[${username}] Mensagem recebida:`, message);

      try {
        const channel = getRabbitChannel();
        channel.sendToQueue("messages", Buffer.from(message));
        console.log(`[${username}] Mensagem enviada para RabbitMQ.`);
      } catch (err) {
        console.error(`[${username}] Erro ao enviar para fila RabbitMQ:`, err);
      }
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
