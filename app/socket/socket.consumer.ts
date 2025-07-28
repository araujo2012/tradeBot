import { connectToRabbitMQ } from "../lib/rabbit";
import { SessionModel } from "../../models/session";
import { OrderModel } from "../../models/order";
import { BotModel } from "../../models/bot";
import { botService } from "../bot/bot.service";
import {
  socketLogon,
  socketUserStream,
  socketOrderPlace,
  socketOrderCancel,
  socketOrderStatus,
} from "./socket.requests";
import { getBinanceSocket } from "./socket.main";
import { sendToUser } from "../../websocket";
import { OrderDoc, OrderEntry } from "../order/order.type";
import { handleExecutedOrder } from "../transaction/transaction.service";

// Rate limit: 5 mensagens por segundo
const RATE_LIMIT = 5;
const INTERVAL_MS = 1000 / RATE_LIMIT;
let processing = false;
const queue: any[] = [];

// Função para processar startSession
async function handleStartSession(sessionId: string) {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  const { apiKey, userId } = session;

  try {
    if (!apiKey) throw new Error(`ApiKey not found: ${sessionId}`);

    const logonResult = await socketLogon({ apiKey, sessionId });
    if (logonResult.code && logonResult.code !== 0) {
      throw new Error(
        `Binance logon error: ${logonResult.msg || logonResult.code}`
      );
    }

    await socketUserStream(sessionId);
    session.status = "active";
    await session.save();

    console.log(`Session ${sessionId} started for user ${sessionId}`);
    sendToUser(userId.toString(), {
      type: "session",
      status: "active",
      sessionId,
    });

    const bots = await BotModel.find({ sessionId, status: "active" });
    for (const bot of bots) {
      botService.startBot(bot._id.toString());
    }
  } catch (err) {
    sendToUser(userId.toString(), {
      type: "session",
      status: "inactive",
      sessionId,
    });
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
  sessionId,
}: {
  apiKey: string;
  origClientOrderId: string;
  symbol: string;
  sessionId: string;
}) {
  try {
    await socketOrderCancel({ apiKey, origClientOrderId, symbol, sessionId });
  } catch (err) {
    console.error("Error creating order:", err);
    throw err;
  }
}

async function handleRestartSession(sessionId: string): Promise<void> {
  await handleStartSession(sessionId);
  const bots = await BotModel.find({
    sessionId,
    status: { $in: ["active", "pending"] },
  });
  for (const bot of bots) {
    botService.startBot(bot._id.toString());
  }
}

async function handleSyncOrder(payload: {
  apiKey: string;
  origClientOrderId: string;
  symbol: string;
  sessionId: string;
}): Promise<void> {
  const { origClientOrderId } = payload;
  const response = await socketOrderStatus(payload);
  const orderData = response?.result;
  if (!orderData || !orderData.clientOrderId) {
    const pendingOrder = await OrderModel.findOne({
      binanceId: origClientOrderId,
    });
    if (!pendingOrder) {
      throw new Error(`Invalid origClientOrderId: ${origClientOrderId}`);
    }
    pendingOrder.status = "closed";
    pendingOrder.save();
    throw new Error("Invalid response from Binance");
  }
  const { clientOrderId, executedQty, updateTime } = orderData;
  const order = (await OrderModel.findOne({
    binanceId: { $in: [clientOrderId, origClientOrderId] },
  })) as OrderDoc | null;
  if (!order) {
    throw new Error(`Could not find order: ${origClientOrderId}`);
  }
  if (clientOrderId !== origClientOrderId) {
    throw new Error(
      `Could not find order: ${origClientOrderId} ou ${clientOrderId}`
    );
  }
  order.status = Number(executedQty) > 0 ? "pending" : "active";
  if (Number(executedQty) > 0) {
    const date = new Date(updateTime);
    order.updateTime = date;
    order.lastExecutedTime = date;
  }
  await order.save();
  if (order.executedQtd < Number(executedQty)) {
    await handleExecutedOrder({
      order,
      executedQtd: Number(executedQty) - order.executedQtd,
    });
  }
  const activeOrders = await OrderModel.find({
    botId: order.botId,
    status: "pending",
  });
  if (!activeOrders) {
    BotModel.updateOne({ _id: "order.botId" }, { status: "active" });
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
        await handleStartSession(content.sessionId);
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
      case "restartSession":
        handleRestartSession(content.sessionId);
        break;
      case "syncOrder":
        await handleSyncOrder(content.payload);
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
