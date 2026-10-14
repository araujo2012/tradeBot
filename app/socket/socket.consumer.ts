import { connectToRabbitMQ } from "../lib/rabbit";
import { SessionModel } from "../../models/session";
import { OrderDocument, OrderModel } from "../../models/order";
import { BotModel } from "../../models/bot";
import { startAdministrator, startManager } from "../bot/bot.service";
import { SymbolConfigModel } from "../../models/symbolConfig";
import {
  socketLogon,
  socketUserStream,
  socketOrderPlace,
  socketOrderCancel,
  socketOrderReplace,
} from "./socket.requests";
import { getBinanceSocket } from "./socket.main";
import { markOrderCanceled } from "./socket.responses";
import { sendToUser } from "../../websocket";
import { OrderEntry } from "../order/order.type";
import { normalizeValue } from "../order/order.utils";
import { stopBotJob } from "../bot/bot.jobs";
import { logger } from "../lib/pino";
import { decrementManagerInFlight } from "../bot/bot.utils";
import { sendToActivateBotQueue } from "../lib/bullMq";

const RATE_LIMIT = 5;
const INTERVAL_MS = 1000 / RATE_LIMIT;
let processing = false;
const queue: any[] = [];
const restartingSessions = new Set<string>();

async function handleStartSession(sessionId: string) {
  console.log("iniciando sessao: ", sessionId);
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

    logger.info(
      `Session ${sessionId} started for user ${session.userId.toString()}`
    );
    sendToUser(userId.toString(), {
      type: "session",
      status: "active",
      sessionId,
    });

    const bots = await BotModel.find({ sessionId, status: "active" });
    for (const bot of bots) {
      switch (bot.mode) {
        case "administrator":
          await startAdministrator(bot, apiKey);
          break;
        case "manager":
          await startManager(bot, apiKey);
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

async function handleStopSession(sessionId: string, userId: string) {
  try {
    const socket = getBinanceSocket(userId);
    if (socket) {
      socket.close();
    }
    const session = await SessionModel.findOne({ _id: sessionId, userId });
    if (!session) throw new Error("Session not found");
    await SessionModel.findByIdAndUpdate(sessionId, {
      status: "inactive",
    });
    logger.warn(`Session ${sessionId} stopped for user ${userId}`);
    sendToUser(userId, { type: "session", status: "inactive", sessionId });
  } catch (err) {
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

    logger.info(
      `Order ${savedOrder ? "updated" : "created"}: ${savedOrder?._id}`
    );

    const { status, result } = await socketOrderPlace({
      order: { ...orderData, apiKey },
      clientId,
    });

    if (status !== 200) {
      logger.info("status !== 200: ", result);
    }
    await decrementManagerInFlight(order.botId.toString());
    if (result?.status === "NEW") {
      savedOrder.status = "active";
      savedOrder.binanceId = result.clientOrderId || "";
      await savedOrder.save();
    } else {
      savedOrder.binanceId = result.clientOrderId || "";
      await handleExecutedOrder(savedOrder, result);
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
    const order = await OrderModel.findOne({
      binanceId: result?.result?.origClientOrderId,
    });
    if (order) {
      await markOrderCanceled(order, Number(result?.result?.executedQty));
      await decrementManagerInFlight(order.botId.toString());
      sendToActivateBotQueue({
        action: "runManagerBot",
        botId: order.botId.toString(),
      });
    }
    logger.info({ result });
  } catch (err) {
    console.error("Error creating order:", err);
    throw err;
  }
}

export async function handleRestartSession(sessionId: string) {
  if (restartingSessions.has(sessionId)) {
    console.warn(`🔁 Restart já em andamento para sessão ${sessionId}`);
    return;
  }

  restartingSessions.add(sessionId);

  let session;
  try {
    session = await SessionModel.findById(sessionId);
    if (!session) {
      console.warn(`⚠️ Sessão não encontrada: ${sessionId}`);
      return;
    }

    const { userId } = session;

    session.status = "reconnecting";
    await session.save();

    sendToUser(userId.toString(), {
      type: "session",
      status: "reconnecting",
      sessionId,
    });

    await stopSessionBots(sessionId);
    await new Promise((r) => setTimeout(r, 1500));
    await handleStartSession(sessionId);
  } catch (err) {
    console.error(`❌ Falha ao reiniciar sessão ${sessionId}`, err);

    if (session?.userId) {
      sendToUser(session.userId.toString(), {
        type: "session",
        status: "inactive",
        sessionId,
      });
    }

    if (session) {
      session.status = "inactive";
      await session.save();
    }
  } finally {
    restartingSessions.delete(sessionId);
  }
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
        binanceId: result?.result?.newOrderResponse?.clientOrderId,
        status: "active",
        clientId: clientId,
        executedQtd: 0,
      };
      const newOrder = await OrderModel.create(orderData);
      if (Number(result?.result?.newOrderResponse?.executedQty) > 0) {
        handleExecutedOrder(newOrder, result?.result);
      }
    }
    await decrementManagerInFlight(order.botId.toString());
    sendToActivateBotQueue({
      action: "runManagerBot",
      botId: order.botId.toString(),
    });
  } catch (err) {
    logger.warn(
      {
        err,
        binanceId,
        order,
      },
      "Order replace failed, trying cancel fallback"
    );
    await handleCancelOrder({
      apiKey,
      origClientOrderId: binanceId,
      symbol: order.symbol,
      sessionId: order.sessionId,
    });
  }
}

async function handleExecutedOrder(order: OrderDocument, result: any) {
  switch (order.mode) {
    case "manager":
      await handleExecutedOrderManager(order, result);
      break;
    default:
      break;
  }
  logger.info("Executed");
}

async function handleExecutedOrderManager(order: OrderDocument, result: any) {
  const executed = Number(result.executedQty);
  if (executed > order.executedQtd) {
    order.executedQtd = executed;
  }
  order.status = "executed";
  await order.save();
}

async function stopSessionBots(sessionId: string) {
  const bots = await BotModel.find({ sessionId, status: "active" });
  for (const bot of bots) {
    try {
      stopBotJob(bot._id.toString());
    } catch (err) {
      console.error(`Erro ao parar bot ${bot._id}`, err);
    }
  }
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const { msg, channel } = queue.shift();
  try {
    const content = JSON.parse(msg.content.toString());
    console.log(content.action);
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
        console.warn("Unknown status:", content.action);
    }
    channel.ack(msg);
  } catch (err) {
    console.error("Error processing socket queue message:", err);
    channel.nack(msg, false, false);
  } finally {
    processing = false;
  }
}

export async function startSocketConsumer() {
  const channel = await connectToRabbitMQ();
  await channel.assertQueue("socket", { durable: true });
  channel.prefetch(50);
  logger.info("[SOCKET CONSUMER] Waiting for messages in 'socket' queue...");

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
