import * as WebSocket from "ws";
import { getRabbitChannel } from "../lib/rabbit";
import { BinanceService } from "./binance.service";
import { StartBinanceSocketParams } from "./binance.interface";

const socketMap: Record<string, WebSocket.WebSocket> = {};

export function startBinanceSocket({
  listenKey,
  username,
  apiKey,
  apiSecret,
}: StartBinanceSocketParams): Promise<void> {
  return new Promise((resolve, reject) => {
    let currentListenKey = listenKey;
    let ws: WebSocket.WebSocket;

    const connect = (lk: string) => {
      ws = new WebSocket.WebSocket(`wss://stream.binance.com:9443/ws/${lk}`);

      ws.on("open", () => {
        console.log(`[${username}] WebSocket aberto.`);
        socketMap[username] = ws;
        resolve();

        setInterval(async () => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.warn(
              `[${username}] Socket não está aberto. Tentando reconectar...`
            );

            try {
              const retryWs = new WebSocket.WebSocket(
                `wss://stream.binance.com:9443/ws/${currentListenKey}`
              );

              retryWs.on("open", () => {
                console.log(
                  `[${username}] Reconectado com sucesso ao mesmo listenKey.`
                );
                socketMap[username] = retryWs;
                ws = retryWs;
              });

              retryWs.on("error", async () => {
                console.warn(
                  `[${username}] Falha ao reconectar com listenKey antigo.`
                );

                if (apiKey && apiSecret) {
                  console.log(`[${username}] Tentando gerar novo listenKey...`);
                  const service = new BinanceService({ apiKey, apiSecret });
                  const result = await service.getBinanceListenKey();

                  if (!result.error) {
                    const newKey = result.data.listenKey;
                    currentListenKey = newKey;
                    console.log(
                      `[${username}] Novo listenKey gerado. Reconectando...`
                    );
                    connect(newKey);
                  } else {
                    console.error(
                      `[${username}] Erro ao gerar novo listenKey:`,
                      result.message
                    );
                  }
                } else {
                  console.error(
                    `[${username}] Sem credenciais para regenerar listenKey.`
                  );
                }
              });
            } catch (err) {
              console.error(`[${username}] Erro ao tentar reconectar:`, err);
            }
          }
        }, 1000 * 60 * 30); // 30 minutos
      });

      ws.on("message", async (data: WebSocket.RawData) => {
        const message = data.toString();
        console.log(`[${username}] Mensagem recebida:`, message);

        try {
          const channel = getRabbitChannel();
          channel.sendToQueue("messages", Buffer.from(message));
          console.log(`[${username}] Mensagem enviada para RabbitMQ.`);
        } catch (err) {
          console.error(
            `[${username}] Erro ao enviar para fila RabbitMQ:`,
            err
          );
        }
      });

      ws.on("close", () => {
        console.log(`[${username}] WebSocket fechado.`);
      });

      ws.on("error", (err: Error) => {
        console.error(`[${username}] Erro no WebSocket:`, err);
        reject(new Error(`Erro ao conectar WebSocket: ${err.message}`));
      });
    };

    connect(currentListenKey);
  });
}
