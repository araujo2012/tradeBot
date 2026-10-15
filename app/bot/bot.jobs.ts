import { BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { normalizeValue } from "../order/order.utils";
import { SymbolConfigModel, SymbolConfigType } from "../../models/symbolConfig";
import { logAndSendToQueue } from "../lib/rabbit";
import { logger } from "../lib/pino";
import {
  decrementManagerInFlight,
  getMinVarianceBot,
  handleRunManagerJobQueue,
  hasInsufficientBalanceLock,
  incrementManagerInFlight,
} from "./bot.utils";
import { SessionModel } from "../../models/session";
import { calculateBollLimits } from "../limits/limits.service";
import { activeStatus } from "../order/order.constants";
const botIntervals: Record<string, NodeJS.Timeout> = {};

export async function runManagerJob(botId: string) {
  // Retorna true para o job terminar sem retry: o bot só volta quando o lock sair.
  if (await hasInsufficientBalanceLock(botId)) return true;
  const canRun = await handleRunManagerJobQueue(botId);
  if (!canRun) return false;
  try {
    const bot = await BotModel.findById(botId);
    if (!bot || bot.status !== "active" || bot.mode !== "manager") return;
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
      sessionId: bot.sessionId.toString(),
      direction: "buy",
      newOrder: buyOrder,
      symbol: bot.symbol,
      apiKey: session.apiKey,
      qtdDecimal: symbolConfig.qtdDecimal,
    });
    await handleOperationManager({
      botId,
      sessionId: bot.sessionId.toString(),
      direction: "sell",
      newOrder: sellOrder,
      symbol: bot.symbol,
      apiKey: session.apiKey,
      qtdDecimal: symbolConfig.qtdDecimal,
    });
  } catch (err) {
    logger.error(`runManagerJob error ${err}`);
  } finally {
    await decrementManagerInFlight(botId);
    return true;
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
      await incrementManagerInFlight(bot._id.toString());
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
  sessionId,
  direction,
  newOrder,
  symbol,
  apiKey,
  qtdDecimal,
}: {
  botId: string;
  sessionId: string;
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
    await incrementManagerInFlight(botId);
    logAndSendToQueue("socket", message);
    return;
  }
  const qtyDiff = Math.abs(newOrder.quantity - order.quantity);
  const priceDiffPercent = Math.abs(newOrder.price - order.price) / order.price;
  if (qtyDiff > qtdDecimal || priceDiffPercent > 0.001) {
    // Sem o sessionId, a reposição sairia por uma conexão nova em vez do socket da sessão.
    const message = {
      action: "replaceOrder",
      payload: {
        botId,
        sessionId,
        mode: "manager",
        direction,
        price: newOrder.price,
        quantity: newOrder.quantity,
        symbol,
      },
      apiKey,
      binanceId: order.binanceId,
    };
    await incrementManagerInFlight(botId);
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

export function stopBotJob(botId: string) {
  if (!botIntervals[botId]) {
    console.warn(`Bot ${botId} não está rodando`);
    return;
  }
  clearInterval(botIntervals[botId]);
  delete botIntervals[botId];
}
