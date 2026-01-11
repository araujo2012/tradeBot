import { BotDocument, BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { normalizeValue } from "../order/order.utils";
import { SymbolConfigModel, SymbolConfigType } from "../../models/symbolConfig";
import { logAndSendToQueue } from "../lib/rabbit";
import { socketOrderStatus } from "../socket/socket.requests";
import { logger } from "../lib/pino";
import {
  finishRunManagerJobQueue,
  getMinVarianceBot,
  handleRunManagerJobQueue,
} from "./bot.utils";
import { SessionModel } from "../../models/session";
import { calculateBollLimits } from "../limits/limits.service";
import { activeStatus } from "../order/order.constants";
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
    status: { $in: activeStatus },
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
  if (!symbolConfig) return;
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
  try {
    const bot = await BotModel.findById(botId);
    if (!bot || bot.status !== "active") return;
    const session = await SessionModel.findById(bot.sessionId).lean();
    if (!session || session.status !== "active") return;
    const orders = await OrderModel.find({
      botId,
      status: { $in: activeStatus },
    });
    const { stopRun, cryptoDelta } = await handleExecutedOrdersManager({
      bot,
      orders,
      session,
    });
    if (cryptoDelta !== 0) {
      bot.crypto += cryptoDelta;
      bot.lastExecutionTime = new Date();
      await bot.save();
    }
    if (stopRun) return;
    const symbolConfig = await SymbolConfigModel.findOne({
      symbol: bot.symbol,
    });
    if (!symbolConfig) return;
    const variance = await setVarianceManager({
      symbolConfig,
      symbol: bot.symbol,
      target: bot.target,
    });
    const { buyOrder, sellOrder } = generateNewOrdersManager({
      variance,
      target: bot.target,
      crypto: bot.crypto,
      symbolConfig,
    });
    await handleOperationManager({
      botId,
      direction: "buy",
      newOrder: buyOrder,
      symbol: bot.symbol,
      apiKey: session.apiKey,
      qtdDecimal: symbolConfig.qtdDecimal,
    });
    await handleOperationManager({
      botId,
      direction: "sell",
      newOrder: sellOrder,
      symbol: bot.symbol,
      apiKey: session.apiKey,
      qtdDecimal: symbolConfig.qtdDecimal,
    });
  } catch (err) {
    logger.error(`runManagerJob error ${err}`);
  } finally {
    await finishRunManagerJobQueue(botId);
  }
}

async function handleExecutedOrdersManager({
  bot,
  orders,
  session,
}: {
  bot: any;
  orders: any[];
  session: { apiKey: string };
}): Promise<{ stopRun: boolean; cryptoDelta: number }> {
  let cryptoDelta = 0;
  const executedOrders = orders.filter((o) => o.executedQtd > 0);
  if (!executedOrders.length) {
    return { stopRun: false, cryptoDelta: 0 };
  }
  for (const order of executedOrders) {
    const isFullyExecuted = order.quantity === order.executedQtd;
    if (isFullyExecuted || order.status === "partialExecuted") {
      cryptoDelta +=
        order.direction === "buy" ? order.executedQtd : -order.executedQtd;
      order.status = "closed";
      await order.save();
    } else {
      logAndSendToQueue("socket", {
        action: "cancelOrder",
        payload: {
          apiKey: session.apiKey,
          origClientOrderId: order.binanceId,
          symbol: bot.symbol,
          sessionId: bot.sessionId.toString(),
        },
      });
      return { stopRun: true, cryptoDelta };
    }
  }
  return { stopRun: false, cryptoDelta };
}

async function handleOperationManager({
  botId,
  direction,
  newOrder,
  symbol,
  apiKey,
  qtdDecimal,
}: {
  botId: string;
  direction: string;
  newOrder: {
    direction: string;
    quantity: number;
    price: number;
  };
  symbol: string;
  apiKey: string;
  qtdDecimal: number;
}) {
  const order = await OrderModel.findOne({
    botId,
    direction,
    status: "active",
  }).lean();
  if (!order) {
    const message = {
      action: "createOrder",
      payload: {
        botId,
        mode: "manager",
        direction: direction,
        price: newOrder.price,
        quantity: newOrder.quantity,
        symbol,
      },
      apiKey,
    };
    logAndSendToQueue("socket", message);
    return;
  }
  const qtyDiff = Math.abs(newOrder.quantity - order.quantity);
  const priceDiffPercent = Math.abs(newOrder.price - order.price) / order.price;
  if (qtyDiff > qtdDecimal || priceDiffPercent > 0.001) {
    const message = {
      action: "replaceOrder",
      payload: {
        botId,
        mode: "manager",
        direction,
        price: newOrder.price,
        quantity: newOrder.quantity,
        symbol,
      },
      apiKey,
      binanceId: order.binanceId,
    };
    logAndSendToQueue("socket", message);
    return;
  }
}

async function setVarianceManager({
  symbolConfig,
  symbol,
  target,
}: {
  symbolConfig: SymbolConfigType;
  symbol: string;
  target: number;
}) {
  const minVariance = await getMinVarianceBot(symbolConfig.minValue, target);
  const { upperLimit, lowerLimit } = await calculateBollLimits({
    symbol: symbol,
    interval: "1h",
    period: 21,
    width: 2.1,
  });
  return Math.max(
    minVariance,
    (upperLimit - lowerLimit) / (upperLimit + lowerLimit)
  );
}

function generateNewOrdersManager({
  variance,
  target,
  crypto,
  symbolConfig,
}: {
  variance: number;
  target: number;
  crypto: number;
  symbolConfig: SymbolConfigType;
}) {
  const moneyDif = variance * target;
  const sellPrice = (target + moneyDif) / crypto;
  const buyPrice = (target - moneyDif) / crypto;
  const sellQuantity = normalizeValue({
    value: moneyDif / sellPrice,
    decimal: symbolConfig.qtdDecimal,
    isRoundUp: false,
  });
  const buyQuantity = normalizeValue({
    value: moneyDif / buyPrice,
    decimal: symbolConfig.qtdDecimal,
    isRoundUp: false,
  });
  const sellOrder = {
    direction: "sell",
    quantity: sellQuantity,
    price: normalizeValue({
      value: sellPrice,
      decimal: symbolConfig.priceDecimal,
      isRoundUp: true,
    }),
  };
  const buyOrder = {
    direction: "buy",
    quantity: buyQuantity,
    price: normalizeValue({
      value: buyPrice,
      decimal: symbolConfig.priceDecimal,
      isRoundUp: false,
    }),
  };
  if (sellOrder.quantity * sellOrder.price < symbolConfig.minValue) {
    sellOrder.quantity = normalizeValue({
      value: moneyDif / sellPrice,
      decimal: symbolConfig.qtdDecimal,
      isRoundUp: true,
    });
  }
  if (buyOrder.quantity * buyOrder.price < symbolConfig.minValue) {
    buyOrder.quantity = normalizeValue({
      value: moneyDif / buyPrice,
      decimal: symbolConfig.qtdDecimal,
      isRoundUp: true,
    });
  }
  return { sellOrder, buyOrder };
}

function generateNewOrdersAdministrator(
  crypto: number,
  target: number,
  variance: number,
  symbolConfig: SymbolConfigType
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
