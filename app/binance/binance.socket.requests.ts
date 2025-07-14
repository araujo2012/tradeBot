import axios from "axios";
import crypto from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { getBinanceSocket } from "./binance.socket";
import { SessionModel } from "../../models/session";
import { redis } from "../lib/redis";

// Lê e prepara a chave privada Ed25519
const PRIVATE_KEY_PATH = path.resolve(
  __dirname,
  "../../../scripts/private_key.pem"
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

// Realiza o session.logon via WebSocket
export async function socketLogon(apiKey: string): Promise<any> {
  const socket = getBinanceSocket();

  if (!socket || socket.readyState !== socket.OPEN) {
    throw new Error("WebSocket is not connected");
  }

  const offset = await getOrSetOffset();
  const timestamp = Date.now() - offset;

  const params = {
    apiKey,
    timestamp,
  };

  const signature = signPayload(params);

  const message = {
    id: crypto.randomUUID(),
    method: "session.logon",
    params: {
      ...params,
      signature,
    },
  };

  // Envia e aguarda resposta (com timeout)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for response from Binance"));
    }, 5000);

    const handleMessage = async (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.id !== message.id) return;

        clearTimeout(timeout);
        socket.off("message", handleMessage);

        // Se erro relacionado a timestamp, invalida cache no Redis
        if (parsed.code && typeof parsed.code === "number") {
          const msg = parsed.msg?.toLowerCase() || "";
          if (msg.includes("timestamp") || parsed.code === -1021) {
            await redis.del("binance:offset");
          }
        }

        resolve(parsed);
      } catch {
        // ignorar mensagens não parseáveis
      }
    };

    socket.on("message", handleMessage);
    socket.send(JSON.stringify(message));
  });
}
