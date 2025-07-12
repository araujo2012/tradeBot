import * as WebSocket from "ws";
import { getRabbitChannel } from "../lib/rabbit";
import { StartBinanceSocketParams } from "./binance.interface";
import { SessionModel } from "../../models/session";
import { BinanceService } from "./binance.service";

// Tornar socketMap globalmente acessível
if (!(global as any).socketMap) {
  (global as any).socketMap = {};
}

const socketMap: Record<string, WebSocket.WebSocket> = (global as any)
  .socketMap;

// Função helper para formatar data/hora
function getTimestamp(): string {
  return new Date().toISOString();
}

async function generateNewListenKey(
  sessionId: string,
  apiKey: string,
  apiSecret: string
): Promise<string | null> {
  try {
    const binanceService = new BinanceService({
      apiKey: apiKey || "",
      apiSecret: apiSecret || "",
    });

    const newKeyResult = await binanceService.getBinanceListenKey();

    if (!newKeyResult.error) {
      const newListenKey = newKeyResult.data.listenKey;
      console.log(
        `[${getTimestamp()}] [${sessionId}] Novo listenKey gerado:`,
        newListenKey
      );

      // Atualizar sessão com novo listenKey
      await SessionModel.findByIdAndUpdate(sessionId, {
        listenKey: newListenKey,
      });

      return newListenKey;
    } else {
      console.error(
        `[${getTimestamp()}] [${sessionId}] Erro ao gerar novo listenKey:`,
        newKeyResult.message
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[${getTimestamp()}] [${sessionId}] Erro ao gerar novo listenKey:`,
      error
    );
    return null;
  }
}

async function reconnectSocket(
  sessionId: string,
  listenKey: string,
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  try {
    console.log(
      `[${getTimestamp()}] [${sessionId}] Tentando reconectar com listenKey atual...`
    );

    // Fechar socket antigo se existir
    closeSocket(sessionId);

    // Tentar conectar com listenKey atual
    await startBinanceSocket({
      listenKey,
      sessionId,
      apiKey,
      apiSecret,
    });

    console.log(
      `[${getTimestamp()}] [${sessionId}] Reconectado com sucesso com listenKey atual.`
    );
    return true;
  } catch (error) {
    console.error(
      `[${getTimestamp()}] [${sessionId}] Falha ao reconectar com listenKey atual:`,
      error
    );

    // Tentar gerar novo listenKey
    const newListenKey = await generateNewListenKey(
      sessionId,
      apiKey,
      apiSecret
    );

    if (newListenKey) {
      try {
        console.log(
          `[${getTimestamp()}] [${sessionId}] Tentando reconectar com novo listenKey...`
        );

        await startBinanceSocket({
          listenKey: newListenKey,
          sessionId,
          apiKey,
          apiSecret,
        });

        console.log(
          `[${getTimestamp()}] [${sessionId}] Reconectado com sucesso com novo listenKey.`
        );
        return true;
      } catch (newError) {
        console.error(
          `[${getTimestamp()}] [${sessionId}] Falha ao reconectar com novo listenKey:`,
          newError
        );
        return false;
      }
    } else {
      console.error(
        `[${getTimestamp()}] [${sessionId}] Não foi possível gerar novo listenKey.`
      );
      return false;
    }
  }
}

async function keepSocketAlive(
  sessionId: string,
  listenKey: string,
  apiKey: string,
  apiSecret: string,
  retryCount: number = 0
): Promise<void> {
  const MAX_RETRIES = 10;

  try {
    const binanceService = new BinanceService({
      apiKey: apiKey || "",
      apiSecret: apiSecret || "",
    });

    const result = await binanceService.keepAliveListenKey(listenKey);

    if (result.error) {
      console.error(
        `[${getTimestamp()}] [${sessionId}] Erro no keep-alive (tentativa ${
          retryCount + 1
        }):`,
        result.message
      );

      if (retryCount < MAX_RETRIES) {
        console.log(
          `[${getTimestamp()}] [${sessionId}] Tentando novamente em 5 segundos...`
        );
        setTimeout(() => {
          keepSocketAlive(
            sessionId,
            listenKey,
            apiKey,
            apiSecret,
            retryCount + 1
          );
        }, 5000);
      } else {
        console.error(
          `[${getTimestamp()}] [${sessionId}] Máximo de tentativas atingido. Gerando novo listenKey e iniciando nova conexão...`
        );

        const newListenKey = await generateNewListenKey(
          sessionId,
          apiKey,
          apiSecret
        );

        if (newListenKey) {
          // Fechar socket antigo e criar nova conexão
          closeSocket(sessionId);
          await startBinanceSocket({
            listenKey: newListenKey,
            sessionId,
            apiKey,
            apiSecret,
          });
        } else {
          console.error(
            `[${getTimestamp()}] [${sessionId}] Falha ao gerar novo listenKey. Marcando sessão como inativa.`
          );
          await SessionModel.findByIdAndUpdate(sessionId, {
            status: "inactive",
          });
        }
      }
    } else {
      console.log(
        `[${getTimestamp()}] [${sessionId}] Keep-alive enviado com sucesso.`
      );
    }
  } catch (error) {
    console.error(
      `[${getTimestamp()}] [${sessionId}] Erro ao enviar keep-alive:`,
      error
    );
    console.error(
      `[${getTimestamp()}] [${sessionId}] Gerando novo listenKey e iniciando nova conexão...`
    );

    const newListenKey = await generateNewListenKey(
      sessionId,
      apiKey,
      apiSecret
    );

    if (newListenKey) {
      // Fechar socket antigo e criar nova conexão
      closeSocket(sessionId);
      await startBinanceSocket({
        listenKey: newListenKey,
        sessionId,
        apiKey,
        apiSecret,
      });
    } else {
      console.error(
        `[${getTimestamp()}] [${sessionId}] Falha ao gerar novo listenKey. Marcando sessão como inativa.`
      );
      await SessionModel.findByIdAndUpdate(sessionId, {
        status: "inactive",
      });
    }
  }
}

export function startBinanceSocket({
  listenKey,
  sessionId,
  apiKey,
  apiSecret,
}: StartBinanceSocketParams): Promise<void> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket.WebSocket;

    ws = new WebSocket.WebSocket(
      `wss://stream.binance.com:9443/ws/${listenKey}`
    );

    ws.on("open", () => {
      console.log(`[${getTimestamp()}] [${sessionId}] WebSocket aberto.`);
      socketMap[sessionId] = ws;
      resolve();

      // Iniciar keep-alive a cada 30 minutos
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          keepSocketAlive(sessionId, listenKey, apiKey || "", apiSecret || "");
        }
      }, 1000 * 60 * 30); // 30 minutos
    });

    ws.on("message", async (data: WebSocket.RawData) => {
      const message = data.toString();
      console.log(
        `[${getTimestamp()}] [${sessionId}] Mensagem recebida:`,
        message
      );

      try {
        const channel = getRabbitChannel();
        channel.sendToQueue("messages", Buffer.from(message));
        console.log(
          `[${getTimestamp()}] [${sessionId}] Mensagem enviada para RabbitMQ.`
        );
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [${sessionId}] Erro ao enviar para fila RabbitMQ:`,
          err
        );
      }
    });

    ws.on("close", async () => {
      console.log(`[${getTimestamp()}] [${sessionId}] WebSocket fechado.`);

      // Mudar status da sessão para inativo quando o socket fechar
      try {
        await SessionModel.findByIdAndUpdate(sessionId, {
          status: "inactive",
        });
        console.log(
          `[${getTimestamp()}] [${sessionId}] Sessão marcada como inativa - socket fechado.`
        );
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [${sessionId}] Erro ao atualizar status da sessão:`,
          err
        );
      }
    });

    ws.on("error", async (err: Error) => {
      console.error(
        `[${getTimestamp()}] [${sessionId}] Erro no WebSocket:`,
        err
      );

      // Tentar reconectar automaticamente
      console.log(
        `[${getTimestamp()}] [${sessionId}] Tentando reconectar após erro...`
      );
      const reconnectSuccess = await reconnectSocket(
        sessionId,
        listenKey,
        apiKey || "",
        apiSecret || ""
      );

      if (!reconnectSuccess) {
        console.error(
          `[${getTimestamp()}] [${sessionId}] Falha na reconexão após erro. Marcando sessão como inativa.`
        );
        try {
          await SessionModel.findByIdAndUpdate(sessionId, {
            status: "inactive",
          });
          console.log(
            `[${getTimestamp()}] [${sessionId}] Sessão marcada como inativa - erro no WebSocket.`
          );
        } catch (updateErr) {
          console.error(
            `[${getTimestamp()}] [${sessionId}] Erro ao atualizar status da sessão:`,
            updateErr
          );
        }
      }

      reject(new Error(`Erro ao conectar WebSocket: ${err.message}`));
    });
  });
}

export function closeSocket(sessionId: string): boolean {
  const socket = socketMap[sessionId];
  if (socket) {
    try {
      socket.close();
      delete socketMap[sessionId];
      console.log(
        `[${getTimestamp()}] [${sessionId}] WebSocket connection closed manually`
      );
      return true;
    } catch (error) {
      console.error(
        `[${getTimestamp()}] [${sessionId}] Error closing WebSocket:`,
        error
      );
      return false;
    }
  }
  return false;
}
