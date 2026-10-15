import axios from "axios";
import crypto from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { getBinanceSocket, initializeBinanceSocket } from "./socket.main";
import { redis } from "../lib/redis";
import { OrderEntry } from "../order/order.type";
import { WebSocket } from "ws";
import { WebsocketDataModel } from "../../models/websocketData";
import { DebugerModel } from "../../models/debuger";
import {
  BinanceAccountResponse,
  BinanceOrderResponse,
} from "../binance/binance.interface";
import { logger } from "../lib/pino";

const PRIVATE_KEY_PATH = path.resolve(
  process.env.BINANCE_PRIVATE_KEY_PATH ||
    path.resolve(__dirname, "../../scripts/private_key.pem")
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

function saveBinanceError(
  sessionId: string,
  message: { id: string; method: string; params?: Record<string, any> },
  response: any
) {
  if (response.status === 200) return;
  const { apiKey, signature, ...params } = message.params || {};
  DebugerModel.create({
    sessionId,
    method: message.method,
    requestId: message.id,
    params,
    status: response.status,
    error: response.error,
  }).catch((err) => logger.error({ err }, "Failed to save Binance error"));
}

async function getOrSetOffset(): Promise<number> {
  const redisKey = "binance:offset";
  const cached = await redis.get(redisKey);
  if (cached) return parseInt(cached, 10);

  const { data } = await axios.get("https://api.binance.com/api/v3/time");
  const offset = Date.now() - data.serverTime;
  await redis.set(redisKey, offset.toString(), "EX", 3600);
  return offset;
}

export async function socketOrderPlace({
  order,
  clientId,
}: {
  order: OrderEntry & {
    apiKey: string;
    sessionId: string;
  };
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
  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;
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
  params.signature = signPayload(params);
  const message = {
    id: clientId,
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
        saveBinanceError(sessionId, message, parsed);

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

export async function socketOrderReplace({
  order,
  clientId,
  binanceId,
  apiKey,
}: {
  order: OrderEntry & {
    sessionId: string;
  };
  apiKey: string;
  binanceId: string;
  clientId: string;
}): Promise<any> {
  const { sessionId } = order;
  let socket = getBinanceSocket(sessionId);
  if (!socket) {
    await initializeBinanceSocket(sessionId);
    socket = getBinanceSocket(sessionId);
  }

  if (!socket) {
    throw new Error("Failed to initialize Binance socket");
  }
  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;
  const params: any = {
    apiKey,
    cancelReplaceMode: "STOP_ON_FAILURE",
    cancelRestrictions: "ONLY_NEW",
    cancelOrigClientOrderId: binanceId,
    price: order.price.toString(),
    quantity: order.quantity.toString(),
    side: order.direction === "buy" ? "BUY" : "SELL",
    symbol: order.symbol,
    timeInForce: "GTC",
    timestamp: timestamp,
    type: "LIMIT",
  };

  params.signature = signPayload(params);
  const message = {
    id: clientId,
    method: "order.cancelReplace",
    params: params,
  };

  logger.info(message);

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
        saveBinanceError(sessionId, message, parsed);

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
        saveBinanceError(sessionId, message, parsed);

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
        saveBinanceError(sessionId, message, parsed);

        if (parsed.code && typeof parsed.code === "number") {
          const msg = parsed.msg?.toLowerCase() || "";
          if (msg.includes("timestamp") || parsed.code === -1021) {
            await redis.del("binance:offset");
          }
        }

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
  let socket = getBinanceSocket(sessionId);
  if (!socket) {
    await initializeBinanceSocket(sessionId);
    socket = getBinanceSocket(sessionId);
  }

  if (!socket) {
    throw new Error("Failed to initialize Binance socket");
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
        saveBinanceError(sessionId, message, parsed);

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
        saveBinanceError(sessionId, message, parsed);
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

export async function socketAccountStatus({
  apiKey,
  sessionId,
}: {
  apiKey: string;
  sessionId: string;
}): Promise<BinanceAccountResponse> {
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
    omitZeroBalances: true,
    timestamp,
  };
  params.signature = signPayload(params);
  const message = {
    id: crypto.randomUUID(),
    method: "account.status",
    params,
  };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timeout waiting for response from Binance (account.status)")
      );
    }, 10000);

    const handleMessage = (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.id !== message.id) return;

        clearTimeout(timeout);
        socket.off("message", handleMessage);
        saveBinanceError(sessionId, message, parsed);
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
