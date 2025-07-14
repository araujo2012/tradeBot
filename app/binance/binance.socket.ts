import WebSocket from "ws";
import { readFileSync } from "fs";
import crypto from "crypto";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const BINANCE_WS_URL = "wss://ws-api.binance.com:443/ws-api/v3";
const API_KEY = process.env.BINANCE_API_KEY!;
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

export function signBinanceParams(params: Record<string, string | number>) {
  // Ordenar os campos como exigido pela Binance
  const sortedKeys = Object.keys(params).sort();
  const payload = sortedKeys.map((key) => `${key}=${params[key]}`).join("&");
  const signatureBuffer = crypto.sign(
    null,
    Buffer.from(payload, "ascii"),
    privateKey
  );
  const signature = signatureBuffer.toString("base64");
  return signature;
}

async function getServerTimeOffset(): Promise<number> {
  const serverTimeRes = await axios.get("https://api.binance.com/api/v3/time");
  const serverTime = serverTimeRes.data.serverTime;
  const localTime = Date.now();
  const offset = localTime - serverTime;

  console.log(`🕒 Offset calculado: ${offset}ms`);
  return offset;
}

async function startBinanceWebSocket() {
  const offset = await getServerTimeOffset();
  const ws = new WebSocket(BINANCE_WS_URL);

  ws.on("open", () => {
    const timestamp = Date.now() - offset;
    const payload = { apiKey: API_KEY, timestamp };
    const signature = signBinanceParams(payload);
    const authPayload = {
      id: crypto.randomUUID(),
      method: "session.logon",
      params: {
        apiKey: API_KEY,
        signature,
        timestamp,
      },
    };
    console.log(JSON.stringify(authPayload));
    ws.send(JSON.stringify(authPayload));
  });

  ws.on("message", (data) => {
    console.log("📨 Mensagem da Binance:", data.toString());
  });

  ws.on("error", (err) => {
    console.error("❌ Erro no WebSocket:", err);
  });

  ws.on("close", () => {
    console.warn("⚠️ Conexão WebSocket encerrada");
  });
}

startBinanceWebSocket().catch(console.error);
