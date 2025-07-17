import axios from "axios";
import crypto from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { getBinanceSocket, initializeBinanceSocket } from "./socket.main";
import { SessionModel } from "../../models/session";
import { redis } from "../lib/redis";

// Lê e prepara a chave privada Ed25519
const PRIVATE_KEY_PATH = path.resolve(
  __dirname,
  "../../scripts/private_key.pem"
);
const privateKeyPem = readFileSync(PRIVATE_KEY_PATH, "utf8");
const privateKey = crypto.createPrivateKey({
  key: privateKeyPem,
  format: "pem",
  type: "pkcs8",
});

// Transforma objeto em payload ordenado e assina
function signPayload(params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort();
  const payload = sortedKeys.map((key) => `${key}=${params[key]}`).join("&");
  const signature = crypto.sign(
    null,
    Buffer.from(payload, "ascii"),
    privateKey
  );
  return signature.toString("base64");
}

// Obtém offset do Redis ou calcula e salva
async function getOrSetOffset(): Promise<number> {
  const redisKey = "binance:offset";
  const cached = await redis.get(redisKey);
  if (cached) return parseInt(cached, 10);

  const { data } = await axios.get("https://api.binance.com/api/v3/time");
  const offset = Date.now() - data.serverTime;

  await redis.set(redisKey, offset.toString(), "EX", 3600); // TTL = 1h
  return offset;
}

// Realiza o place order via WebSocket
export async function socketOrderPlace({
  order,
  session,
  bot,
}: {
  order: any;
  session: any;
  bot: any;
}): Promise<any> {
  // Obter ou inicializar o socket da Binance
  let socket = getBinanceSocket(bot.userId.toString());
  if (!socket) {
    await initializeBinanceSocket(bot.userId.toString());
    socket = getBinanceSocket(bot.userId.toString());
  }

  if (!socket) {
    throw new Error("Failed to initialize Binance socket");
  }

  // Obter offset do timestamp
  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;

  // Preparar os parâmetros da ordem
  const params: any = {
    apiKey: session.apiKey,
    price: order.price.toString(),
    quantity: order.quantity.toString(),
    side: order.direction === "buy" ? "BUY" : "SELL",
    symbol: order.symbol,
    timeInForce: "GTC",
    timestamp: timestamp,
    type: "LIMIT",
  };

  // Criar a mensagem para o socket
  const message = {
    id: crypto.randomUUID(),
    method: "order.place",
    params: params,
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timeout waiting for response from Binance (place order)")
      );
    }, 10000);

    const handleMessage = (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.id !== message.id) return;

        clearTimeout(timeout);
        socket.off("message", handleMessage);

        resolve(parsed);
      } catch {
        // ignorar mensagens inválidas
      }
    };

    socket.on("message", handleMessage);
    //socket.send(JSON.stringify(message));
  });
}

export async function socketUserStream(userId: string): Promise<any> {
  const socket = getBinanceSocket(userId);

  if (!socket || socket.readyState !== socket.OPEN) {
    throw new Error("WebSocket is not connected");
  }

  const message = {
    id: crypto.randomUUID(),
    method: "userDataStream.subscribe",
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timeout waiting for response from Binance (user stream)")
      );
    }, 10000);

    const handleMessage = (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.id !== message.id) return;

        clearTimeout(timeout);
        socket.off("message", handleMessage);

        resolve(parsed);
      } catch {
        // ignorar mensagens inválidas
      }
    };

    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}

// Realiza o session.logon via WebSocket
export async function socketLogon(
  apiKey: string,
  userId: string
): Promise<any> {
  const socket = getBinanceSocket(userId);

  if (!socket || socket.readyState !== socket.OPEN) {
    throw new Error("WebSocket is not connected");
  }

  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;
  const signature = signPayload({ apiKey, timestamp });

  const message = {
    id: crypto.randomUUID(),
    method: "session.logon",
    params: { apiKey, signature, timestamp },
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for response from Binance"));
    }, 10000);

    const handleMessage = async (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.id !== message.id) return;

        clearTimeout(timeout);
        socket.off("message", handleMessage);

        if (parsed.code && typeof parsed.code === "number") {
          const msg = parsed.msg?.toLowerCase() || "";
          if (msg.includes("timestamp") || parsed.code === -1021) {
            await redis.del("binance:offset");
          }
        }

        resolve(parsed);
      } catch {
        // ignorar mensagens inválidas
      }
    };

    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}

export async function socketOrderCancel({
  apiKey,
  symbol,
  origClientOrderId,
  userId,
}: {
  apiKey: string;
  symbol: string;
  origClientOrderId: string;
  userId: string;
}): Promise<any> {
  // Obter ou inicializar o socket da Binance
  let socket = getBinanceSocket(userId);
  if (!socket) {
    await initializeBinanceSocket(userId);
    socket = getBinanceSocket(userId);
  }

  if (!socket) {
    throw new Error("Failed to initialize Binance socket");
  }

  // Obter offset do timestamp
  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;

  // Preparar os parâmetros do cancelamento
  const params: any = {
    apiKey,
    origClientOrderId,
    symbol,
    timestamp,
  };

  const message = {
    id: crypto.randomUUID(),
    method: "order.cancel",
    params: params,
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timeout waiting for response from Binance (cancel order)")
      );
    }, 10000);

    const handleMessage = (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.id !== message.id) return;

        clearTimeout(timeout);
        socket.off("message", handleMessage);

        resolve(parsed);
      } catch {
        // ignorar mensagens inválidas
      }
    };

    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}
