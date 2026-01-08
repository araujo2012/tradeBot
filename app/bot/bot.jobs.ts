import { BotDocument, BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { normalizeValue } from "../order/order.utils";
import { SymbolConfigModel } from "../../models/symbolConfig";
import { logAndSendToQueue } from "../lib/rabbit";
import { socketOrderStatus } from "../socket/socket.requests";
import { logger } from "../lib/pino";
import { handleRunManagerJobQueue } from "./bot.utils";
import { SessionModel } from "models/session";
const botStarting = new Set<string>();
const botIntervals: Record<string, NodeJS.Timeout> = {};

export async function runBotJob(botId: string, apiKey: string) {
  const bot = await BotModel.findById(botId);
  switch (bot?.mode) {
    case "administrator":
      await runAdministratorJob(bot, apiKey);
      break;
    default:
      break;
  }
}

async function runAdministratorJob(bot: BotDocument, apiKey: string) {
  const orders = await OrderModel.find({
    botId: bot._id,
    status: { $in: ["active", "executed"] },
  });
  const filledOrders = orders.filter(
    (order) => order.executedQtd === order.quantity
  );
  let buyModifier = 0;
  let sellModifier = 0;
  await Promise.all(
    filledOrders.map((order) => {
      if (order.direction === "buy") {
        bot.crypto += order.executedQtd;
        buyModifier += 1;
        sellModifier -= 1;
      } else {
        bot.crypto -= order.executedQtd;
        sellModifier += 1;
        buyModifier -= 1;
      }
      order.status = "closed";
      order.save();
    })
  );
  const executedOrders = orders.filter(
    (order) =>
      order.executedQtd !== order.quantity && order.status === "executed"
  );
  await Promise.all(
    executedOrders.map(async (order) => {
      const result = await socketOrderStatus({
        apiKey,
        origClientOrderId: order.binanceId,
        symbol: order.symbol,
        sessionId: order.sessionId.toString(),
      });
      if (result?.result?.status === "CANCELED") {
        order.status = "closed";
        if (order.direction === "buy") {
          bot.crypto += order.executedQtd;
          buyModifier += 1;
          sellModifier -= 1;
        } else {
          bot.crypto -= order.executedQtd;
          sellModifier += 1;
          buyModifier -= 1;
        }
        order.save();
      }
    })
  );
  await bot.save();
  let activeOrders = orders.filter(
    (order) => order.executedQtd !== order.quantity && order.status !== "closed"
  );
  let wasCancelled = false;
  let message: any;
  await Promise.all(
    activeOrders.map((order) => {
      let position = order.position as number;
      position -= order.direction === "buy" ? buyModifier : sellModifier;
      order.position = position;
      if (position >= 4) {
        message = {
          action: "cancelOrder",
          payload: {
            apiKey,
            origClientOrderId: order.binanceId,
            symbol: bot.symbol,
            sessionId: bot.sessionId.toString(),
          },
        };
        logAndSendToQueue("socket", message);
        wasCancelled = true;
      }
      order.save();
    })
  );
  if (wasCancelled) return;
  const crypto =
    bot.crypto +
    activeOrders.reduce((acc, order) => {
      return order.direction === "buy"
        ? acc + order.executedQtd
        : acc - order.executedQtd;
    }, 0);
  const variance = bot.target * 0.013;
  const symbolConfig = await SymbolConfigModel.findOne({
    symbol: bot.symbol,
  }).lean();
  const [buyOrders, sellOrders] = generateNewOrdersAdministrator(
    crypto,
    bot.target,
    variance,
    symbolConfig
  );
  let buyPosition = 0;
  let sellPosition = 0;
  let buyOperation = "";
  let sellOperation = "";
  for (let i = 3; i > 0; i -= 1) {
    const buyOrder = buyOrders[3 - i];
    const buyActiveOrder = activeOrders.find(
      (order) =>
        order.position === buyOrder.position && order.direction === "buy"
    );
    if (!buyActiveOrder) {
      buyOperation = "create";
    } else {
      if (buyActiveOrder.executedQtd > 0) {
        buyOperation = "cancel";
      }
      if (
        buyActiveOrder.quantity !== buyOrder.quantity ||
        buyActiveOrder.price !== buyOrder.price
      ) {
        buyOperation = "replace";
      }
    }
    if (buyOperation !== "") {
      buyPosition = i;
      break;
    }
  }
  for (let i = 3; i > 0; i -= 1) {
    const sellOrder = sellOrders[3 - i];
    const sellActiveOrder = activeOrders.find(
      (order) =>
        order.position === sellOrder.position && order.direction === "sell"
    );
    if (!sellActiveOrder) {
      sellOperation = "create";
    } else {
      if (sellActiveOrder.executedQtd > 0) {
        sellOperation = "cancel";
      }
      if (
        sellActiveOrder.quantity !== sellOrder.quantity ||
        sellActiveOrder.price !== sellOrder.price
      ) {
        sellOperation = "replace";
      }
    }
    if (sellOperation !== "") {
      sellPosition = i;
      break;
    }
  }
  let order: any;
  switch (buyOperation) {
    case "create":
      order = buyOrders.find((order) => order.position === buyPosition);
      if (!order) break;
      message = {
        action: "createOrder",
        payload: {
          botId: bot._id.toString(),
          mode: "administrator",
          direction: "buy",
          price: order.price,
          quantity: order.quantity,
          symbol: bot.symbol,
          position: buyPosition,
        },
        apiKey,
      };
      logAndSendToQueue("socket", message);
      break;
    case "cancel":
      order = activeOrders.find(
        (order) => order.direction === "buy" && order.position === buyPosition
      );
      message = {
        action: "cancelOrder",
        payload: {
          apiKey,
          origClientOrderId: order.clientId,
          symbol: bot.symbol,
          sessionId: bot.sessionId.toString(),
        },
      };
      logAndSendToQueue("socket", message);
      break;
    case "replace":
      order = buyOrders.find((order) => order.position === buyPosition);
      const binanceId = activeOrders.find(
        (order) => order.direction === "buy" && order.position === buyPosition
      )?.binanceId;
      if (!order) break;
      message = {
        action: "replaceOrder",
        payload: {
          botId: bot._id.toString(),
          mode: "administrator",
          direction: "buy",
          price: order.price,
          quantity: order.quantity,
          symbol: bot.symbol,
          position: buyPosition,
        },
        apiKey,
        binanceId,
      };
      logAndSendToQueue("socket", message);
      break;
    default:
      break;
  }
  switch (sellOperation) {
    case "create":
      order = sellOrders.find((order) => order.position === sellPosition);
      if (!order) break;
      message = {
        action: "createOrder",
        payload: {
          botId: bot._id.toString(),
          mode: "administrator",
          direction: "sell",
          price: order.price,
          quantity: order.quantity,
          symbol: bot.symbol,
          position: sellPosition,
        },
        apiKey,
      };
      logAndSendToQueue("socket", message);
      break;
    case "cancel":
      order = activeOrders.find(
        (order) => order.direction === "sell" && order.position === sellPosition
      );
      message = {
        action: "cancelOrder",
        payload: {
          apiKey,
          origClientOrderId: order.clientId,
          symbol: bot.symbol,
          sessionId: bot.sessionId.toString(),
        },
      };
      logAndSendToQueue("socket", message);
      break;
    case "replace":
      order = sellOrders.find((order) => order.position === sellPosition);
      const binanceId = activeOrders.find(
        (order) => order.direction === "sell" && order.position === sellPosition
      )?.binanceId;
      if (!order) break;
      message = {
        action: "replaceOrder",
        payload: {
          botId: bot._id.toString(),
          mode: "administrator",
          direction: "sell",
          price: order.price,
          quantity: order.quantity,
          symbol: bot.symbol,
          position: sellPosition,
        },
        apiKey,
        binanceId,
      };
      logAndSendToQueue("socket", message);
      break;
    default:
      break;
  }
}

export async function runManagerJob(botId: string) {
  const canRun = await handleRunManagerJobQueue(botId);
  if (!canRun) return;
  const orders = await OrderModel.find({
    botId,
    status: { $in: ["active", "executed", "partialExecuted"] },
  });
  const bot = await BotModel.findOne({ _id: botId });
  if (!bot) {
    logger.error(`${botId} nao encontrado`);
    return;
  }
  const session = await SessionModel.findOne({
    _id: bot.sessionId.toString(),
  }).lean();
  const executedOrders = orders.filter((order) => order.executedQtd > 0);
  if (executedOrders.length > 0) {
    let stopRun = false;
    executedOrders.forEach(async (order) => {
      const isFullyExecuted = order.quantity === order.executedQtd;
      if (isFullyExecuted || order.status === "partialExecuted") {
        bot.crypto +=
          order.direction === "buy"
            ? order.executedQtd
            : -1 * order.executedQtd;
        order.status = "closed";
        await order.save();
      } else {
        const message = {
          action: "cancelOrder",
          payload: {
            apiKey: session?.apiKey,
            origClientOrderId: order.binanceId,
            symbol: bot.symbol,
            sessionId: bot.sessionId.toString(),
          },
        };
        logAndSendToQueue("socket", message);
        stopRun = true;
      }
    });
    bot.lastExecutionTime = new Date();
    await bot.save();
    if (stopRun) return;
  }
  //TODO se tiver ordem executada, atualiza o bot
  //TODO calcula a variancia minima do bot
  //TODO calcula a variancia por bolinger
  //TODO calcula o valor da ordem de compra e venda
  //TODO se nao tem ordem ativa, sobe a ordem, se tem ordem ativa chama funcao de atualizar a ordem
}

function generateNewOrdersAdministrator(
  crypto: number,
  target: number,
  variance: number,
  symbolConfig: any
) {
  const buyOrders: {
    direction: "buy";
    quantity: number;
    price: number;
    position: number;
  }[] = [];
  const sellOrders: {
    direction: "sell";
    quantity: number;
    price: number;
    position: number;
  }[] = [];
  let simulatedCrypto = crypto;
  let count = 0;
  while (count < 3) {
    const sellPrice = (target + variance) / simulatedCrypto;
    const sellQuantity = normalizeValue({
      value: variance / sellPrice,
      decimal: symbolConfig.qtdDecimal,
      isRoundUp: false,
    });
    sellOrders.push({
      direction: "sell",
      quantity: sellQuantity,
      price: normalizeValue({
        value: sellPrice,
        decimal: symbolConfig.priceDecimal,
        isRoundUp: true,
      }),
      position: count + 1,
    });
    simulatedCrypto -= sellQuantity;
    count += 1;
  }
  simulatedCrypto = crypto;
  count = 0;
  while (count < 3) {
    const buyPrice = (target - variance) / simulatedCrypto;
    const buyQuantity = normalizeValue({
      value: variance / buyPrice,
      decimal: symbolConfig.qtdDecimal,
      isRoundUp: false,
    });
    buyOrders.push({
      direction: "buy",
      quantity: buyQuantity,
      price: normalizeValue({
        value: buyPrice,
        decimal: symbolConfig.priceDecimal,
        isRoundUp: false,
      }),
      position: count + 1,
    });
    simulatedCrypto += buyQuantity;
    count += 1;
  }
  return [buyOrders.reverse(), sellOrders.reverse()];
}

export async function startBotJob(botId: string, apiKey: string) {
  if (botIntervals[botId] || botStarting.has(botId)) return;
  botStarting.add(botId);
  const delay = Math.floor(Math.random() * 60_000);
  await new Promise((r) => setTimeout(r, delay));
  if (botIntervals[botId]) {
    botStarting.delete(botId);
    return;
  }
  try {
    await runBotJob(botId, apiKey);
  } catch (err) {
    console.error(err);
  }

  botIntervals[botId] = setInterval(() => {
    runBotJob(botId, apiKey).catch(console.error);
  }, 60_000);
  botStarting.delete(botId);
  logger.info(`🤖 Bot ${botId} iniciado.`);
}

export function stopBotJob(botId: string) {
  if (!botIntervals[botId]) {
    console.warn(`Bot ${botId} não está rodando`);
    return;
  }
  clearInterval(botIntervals[botId]);
  delete botIntervals[botId];
  botStarting.delete(botId);
}
