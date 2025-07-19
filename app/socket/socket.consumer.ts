import { connectToRabbitMQ } from "../lib/rabbit";
import { SessionModel } from "../../models/session";
import { BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { initializeBinanceSocket } from "./socket.main";
import {
  socketLogon,
  socketUserStream,
  socketOrderPlace,
  socketOrderCancel,
} from "./socket.requests";
import { getBinanceSocket } from "./socket.main";
import { sendToUser } from "../../websocket";
import { OrderDoc, OrderEntry } from "app/order/order.type";

// Rate limit: 5 mensagens por segundo
const RATE_LIMIT = 5;
const INTERVAL_MS = 1000 / RATE_LIMIT;
let processing = false;
const queue: any[] = [];

// Função para processar startSession
async function handleStartSession(sessionId: string, userId: string) {
  try {
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
    // Sucesso: status active
    sendToUser(userId, { type: "session", status: "active", sessionId });
  } catch (err) {
    // Falha: status inactive
    sendToUser(userId, { type: "session", status: "inactive", sessionId });
    throw err;
  }
}

// Função para processar stopSession
async function handleStopSession(sessionId: string, userId: string) {
  try {
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
    // Sucesso: status inactive
    sendToUser(userId, { type: "session", status: "inactive", sessionId });
  } catch (err) {
    // Falha: status active
    sendToUser(userId, { type: "session", status: "active", sessionId });
    throw err;
  }
}

async function handleCreateOrder(order: OrderEntry) {
  try {
    const clientId = crypto.randomUUID();
    const { botId, type, interval, direction } = order;
    const orderData = {
      ...order,
      binanceId: "",
      status: "pending",
      clientId: clientId,
    };

    const savedOrder = await OrderModel.findOneAndUpdate(
      {
        botId,
        type,
        interval,
        direction,
      },
      orderData,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      `Order ${savedOrder ? "updated" : "created"}: ${savedOrder?._id}`
    );

    const result = await socketOrderPlace({ order, clientId });
  } catch (err) {
    console.error("Error creating order:", err);
    throw err;
  }
}

async function handleCancelOrder({
  apiKey,
  origClientOrderId,
  symbol,
  userId,
}: {
  apiKey: string;
  origClientOrderId: string;
  symbol: string;
  userId: string;
}) {
  try {
    await socketOrderCancel({ apiKey, origClientOrderId, symbol, userId });
  } catch (err) {
    console.error("Error creating order:", err);
    throw err;
  }
}

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
      case "createOrder":
        await handleCreateOrder(content.payload);
        break;
      case "cancelOrder":
        await handleCancelOrder(content.payload);
        break;
      default:
        console.warn("Unknown status:", content.status);
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
  channel.prefetch(50);
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
