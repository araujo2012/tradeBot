import axios from "axios";
import crypto from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { getBinanceSocket, initializeBinanceSocket } from "./socket.main";
import { redis } from "../lib/redis";
import { OrderEntry } from "..//order/order.type";
import { WebSocket } from "ws";
import { WebsocketDataModel } from "../../models/websocketData";
import { OrderModel } from "../../models/order";
import { BinanceOrderResponse } from "../binance/binance.interface";

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

async function getOrSetOffset(): Promise<number> {
  const redisKey = "binance:offset";
  const cached = await redis.get(redisKey);
  if (cached) return parseInt(cached, 10);

  const { data } = await axios.get("https://api.binance.com/api/v3/time");
  const offset = Date.now() - data.serverTime;

  await redis.set(redisKey, offset.toString(), "EX", 3600); // TTL = 1h
  return offset;
}

export async function socketOrderPlace({
  order,
  clientId,
}: {
  order: OrderEntry;
  clientId: string;
}): Promise<any> {
  const { sessionId, apiKey } = order;
  let socket = getBinanceSocket(sessionId);
  if (!socket) {
    await initializeBinanceSocket(sessionId);
    socket = getBinanceSocket(sessionId);
  }

  if (!socket) {
    throw new Error("Failed to initialize Binance socket");
  }

  // Obter offset do timestamp
  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;

  // Preparar os parâmetros da ordem
  const params: any = {
    apiKey,
    price: order.price.toString(),
    quantity: order.quantity.toString(),
    side: order.direction === "buy" ? "BUY" : "SELL",
    symbol: order.symbol,
    timeInForce: "GTC",
    timestamp: timestamp,
    type: "LIMIT",
  };

  // Assinar os parâmetros
  params.signature = signPayload(params);

  // Criar a mensagem para o socket
  const message = {
    id: clientId,
    method: "order.place",
    params: params,
  };

  console.log(message);

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
    WebsocketDataModel.create({
      sessionId,
      type: "sended",
      payload: { message },
    });
    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}

export async function socketOrderReplace({
  order,
  clientId,
}: {
  order: OrderEntry;
  clientId: string;
}): Promise<any> {
  const { sessionId, apiKey } = order;
  let socket = getBinanceSocket(sessionId);
  if (!socket) {
    await initializeBinanceSocket(sessionId);
    socket = getBinanceSocket(sessionId);
  }

  if (!socket) {
    throw new Error("Failed to initialize Binance socket");
  }

  const oldOrder = await OrderModel.findOne({
    botId: order.botId,
    symbol: order.symbol,
    type: order.type,
    direction: order.direction,
    interval: order.interval,
  });

  if (!oldOrder) {
    console.log("Nao foi possivel achar a ordem antiga: ", order);
    throw new Error("Nao foi possivel achar a ordem antiga.");
  }

  // Obter offset do timestamp
  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;

  // Preparar os parâmetros da ordem
  const params: any = {
    apiKey,
    cancelReplaceMode: "STOP_ON_FAILURE",
    cancelRestrictions: "ONLY_NEW",
    cancelOrigClientOrderId: oldOrder.binanceId,
    price: order.price.toString(),
    quantity: order.quantity.toString(),
    side: order.direction === "buy" ? "BUY" : "SELL",
    symbol: order.symbol,
    timeInForce: "GTC",
    timestamp: timestamp,
    type: "LIMIT",
  };

  // Assinar os parâmetros
  params.signature = signPayload(params);

  // Criar a mensagem para o socket
  const message = {
    id: clientId,
    method: "order.cancelReplace",
    params: params,
  };

  console.log(message);

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
    WebsocketDataModel.create({
      sessionId,
      type: "sended",
      payload: { message },
    });
    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}

export async function socketUserStream(sessionId: string): Promise<any> {
  const socket = getBinanceSocket(sessionId);

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
    WebsocketDataModel.create({
      sessionId,
      type: "sended",
      payload: { message },
    });
    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}

export async function socketLogon({
  apiKey,
  sessionId,
}: {
  apiKey: string;
  sessionId: string;
}): Promise<any> {
  let socket = getBinanceSocket(sessionId);
  if (!socket) {
    await initializeBinanceSocket(sessionId);
    socket = getBinanceSocket(sessionId) as WebSocket;
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
    WebsocketDataModel.create({
      sessionId,
      type: "sended",
      payload: { message },
    });
    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}

export async function socketOrderCancel({
  apiKey,
  symbol,
  origClientOrderId,
  sessionId,
}: {
  apiKey: string;
  symbol: string;
  origClientOrderId: string;
  sessionId: string;
}): Promise<BinanceOrderResponse> {
  // Obter ou inicializar o socket da Binance
  let socket = getBinanceSocket(sessionId);
  if (!socket) {
    await initializeBinanceSocket(sessionId);
    socket = getBinanceSocket(sessionId);
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

  params.signature = signPayload(params);

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
    WebsocketDataModel.create({
      sessionId,
      type: "sended",
      payload: { message },
    });
    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}

export async function socketOrderStatus({
  apiKey,
  origClientOrderId,
  symbol,
  sessionId,
}: {
  apiKey: string;
  origClientOrderId: string;
  symbol: string;
  sessionId: string;
}): Promise<BinanceOrderResponse> {
  let socket = getBinanceSocket(sessionId);
  if (!socket) {
    await initializeBinanceSocket(sessionId);
    socket = getBinanceSocket(sessionId);
    if (!socket) throw new Error("Failed to initialize WebSocket");
  }
  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;
  const params: any = {
    apiKey,
    origClientOrderId,
    symbol,
    timestamp,
  };
  params.signature = signPayload(params);

  const message = {
    id: crypto.randomUUID(),
    method: "order.status",
    params,
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timeout waiting for response from Binance (order.status)")
      );
    }, 10000);

    const handleMessage = (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.id !== message.id) return;

        clearTimeout(timeout);
        socket.off("message", handleMessage);
        resolve(parsed);
      } catch {}
    };
    WebsocketDataModel.create({
      sessionId,
      type: "sended",
      payload: { message },
    });
    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}
