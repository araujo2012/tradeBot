import { connectToRabbitMQ } from "../lib/rabbit";
import { SessionModel } from "../../models/session";
import { initializeBinanceSocket } from "./socket.main";
import { socketLogon, socketUserStream } from "./socket.requests";
import { getBinanceSocket } from "./socket.main";

// Função para processar startSession
async function handleStartSession(sessionId: string, userId: string) {
  const session = await SessionModel.findOne({ _id: sessionId, userId });
  if (!session) throw new Error("Session not found");

  let socket = getBinanceSocket(userId);
  if (!socket) {
    await initializeBinanceSocket(userId);
    socket = getBinanceSocket(userId);
  }

  const logonResult = await socketLogon(session.apiKey, userId);
  if (logonResult.code && logonResult.code !== 0) {
    throw new Error(
      `Binance logon error: ${logonResult.msg || logonResult.code}`
    );
  }
  await socketUserStream(userId);
  await SessionModel.findByIdAndUpdate(sessionId, { status: "active" });
  console.log(`Session ${sessionId} started for user ${userId}`);
}

// Função para processar stopSession
async function handleStopSession(sessionId: string, userId: string) {
  // Encerra o socket se existir
  const socket = getBinanceSocket(userId);
  if (socket) {
    socket.close();
  }
  const session = await SessionModel.findOne({ _id: sessionId, userId });
  if (!session) throw new Error("Session not found");
  await SessionModel.findByIdAndUpdate(sessionId, {
    status: "inactive",
  });
  console.log(`Session ${sessionId} stopped for user ${userId}`);
}

// Rate limit: 5 mensagens por segundo
const RATE_LIMIT = 5;
const INTERVAL_MS = 1000 / RATE_LIMIT;
let processing = false;
const queue: any[] = [];

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const { msg, channel } = queue.shift();
  try {
    const content = JSON.parse(msg.content.toString());
    switch (content.action) {
      case "startSession":
        await handleStartSession(content.sessionId, content.userId);
        break;
      case "stopSession":
        await handleStopSession(content.sessionId, content.userId);
        break;
      default:
        console.warn("Unknown action:", content.action);
    }
    channel.ack(msg);
  } catch (err) {
    console.error("Error processing socket queue message:", err);
    channel.nack(msg, false, false); // descarta mensagem com erro
  } finally {
    processing = false;
  }
}

export async function startSocketConsumer() {
  const channel = await connectToRabbitMQ();
  await channel.assertQueue("socket", { durable: true });
  console.log("[SOCKET CONSUMER] Waiting for messages in 'socket' queue...");

  channel.consume(
    "socket",
    (msg) => {
      if (msg) {
        queue.push({ msg, channel });
      }
    },
    { noAck: false }
  );

  setInterval(processQueue, INTERVAL_MS);
}
