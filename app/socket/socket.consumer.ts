import { connectToRabbitMQ } from "../lib/rabbit";
import { SessionModel } from "../../models/session";
import { OrderModel } from "../../models/order";
import { BotModel } from "../../models/bot";
import { botService } from "../bot/bot.service";
import { SymbolConfigModel } from "../../models/symbolConfig";
import {
  socketLogon,
  socketUserStream,
  socketOrderPlace,
  socketOrderCancel,
  socketOrderStatus,
  socketOrderReplace,
} from "./socket.requests";
import { getBinanceSocket } from "./socket.main";
import { sendToUser } from "../../websocket";
import { OrderDoc, OrderEntry } from "../order/order.type";
import { handleExecutedOrder } from "../transaction/transaction.service";
import { normalizeValue } from "../order/order.utils";

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
      switch (bot.mode) {
        case "administrator":
          await botService.startAdministrator(bot, apiKey);
          break;
        default:
          break;
      }
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

async function handleCreateOrder(order: OrderEntry, apiKey: string) {
  try {
    const symbolConfig = await SymbolConfigModel.findOne({
      symbol: order.symbol,
    });
    const bot = await BotModel.findById(order.botId);
    if (!symbolConfig || !bot) throw new Error(`${order.symbol} nao existe`);
    order.quantity = normalizeValue({
      value: order.quantity,
      isRoundUp: order.mode !== "administrator",
      decimal: symbolConfig.qtdDecimal,
    });
    order.price = normalizeValue({
      value: order.price,
      isRoundUp: order.direction === "sell",
      decimal: symbolConfig.priceDecimal,
    });
    const clientId = crypto.randomUUID();
    const orderData = {
      ...order,
      sessionId: bot.sessionId.toString(),
      userId: bot.userId.toString(),
      binanceId: "",
      status: "pending",
      clientId: clientId,
      executedQtd: 0,
    };

    const savedOrder = await OrderModel.create(orderData);

    console.log(
      `Order ${savedOrder ? "updated" : "created"}: ${savedOrder?._id}`
    );

    const { status, result } = await socketOrderPlace({
      order: { ...orderData, apiKey },
      clientId,
    });

    if (status !== 200) {
      console.log("status !== 200: ", result);
    }

    if (result?.status === "NEW") {
      savedOrder.status = "active";
      savedOrder.binanceId = result.clientOrderId || "";
      await savedOrder.save();
    } else {
      await handleExecutedOrder();
    }
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
    const result = await socketOrderCancel({
      apiKey,
      origClientOrderId,
      symbol,
      sessionId,
    });
    if (Number(result?.result?.executedQty) > 0) {
      await handleExecutedOrder();
    } else {
      const order = await OrderModel.findOne({
        binanceId: result?.result?.origClientOrderId,
      });
      if (order) {
        order.status = "closed";
        await order.save();
      }
    }
    console.log({ result });
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
    botService.startBot(bot._id.toString(), apiKey);
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
}

async function handleReplaceOrder(
  order: OrderEntry & {
    sessionId: string;
  },
  apiKey: string,
  binanceId: string
) {
  try {
    const clientId = crypto.randomUUID();
    const result = await socketOrderReplace({
      order,
      clientId,
      binanceId,
      apiKey,
    });
    if (result?.result?.cancelResult === "SUCCESS") {
      const cancelOrder = await OrderModel.findOne({
        binanceId: result?.result?.cancelResponse?.origClientOrderId,
      });
      if (cancelOrder) {
        cancelOrder.status = "closed";
        await cancelOrder.save();
      }
    }
    if (result?.result?.newOrderResult === "SUCCESS") {
      const bot = await BotModel.findById(order.botId);
      const orderData = {
        ...order,
        sessionId: bot?.sessionId.toString(),
        userId: bot?.userId.toString(),
        binanceId: result?.result?.newOrderResult?.clientOrderId,
        status: "active",
        clientId: clientId,
        executedQtd: 0,
      };
      await OrderModel.create(orderData);
    }
  } catch (err) {
    console.error("Error creating order:", err);
    throw err;
  }
}

async function handleExecutedOrder() {
  console.log("Executed");
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
      case "restartSession":
        handleRestartSession(content.sessionId);
        break;
      case "createOrder":
        await handleCreateOrder(content.payload, content.apiKey);
        break;
      case "cancelOrder":
        await handleCancelOrder(content.payload);
        break;
      case "replaceOrder":
        await handleReplaceOrder(
          content.payload,
          content.apiKey,
          content.binanceId
        );
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
