import { calculateBollLimits } from "../limits/limits.service";
import { OrderModel } from "../../models/order";
import { intervalList, intervalData, tax } from "./order.constants";
import type { BotType } from "../bot/bot.type";
import type { OrderEntry, IntervalType } from "./order.type";
import {
  getLastExecutedTimeFromInterval,
  getSpeed,
  getSymbolConfig,
  minutesSince,
  normalizeValue,
} from "./order.utils";
import { getRabbitChannel, logAndSendToQueue } from "../lib/rabbit";
import { getCurrentPrice } from "../binance/binance.service";
import { TransactionModel } from "../../models/transaction";

function calculateEntryOrder({
  bot,
  interval,
  isEntry,
  isNormal,
  upperLimit,
  lowerLimit,
  qtdDecimal,
}: {
  bot: BotType;
  interval: IntervalType;
  isEntry: boolean;
  isNormal: boolean;
  upperLimit: number;
  lowerLimit: number;
  qtdDecimal: number;
}) {
  const quantity =
    bot.crypto *
    (1 - bot.sellProtection / 100) *
    getSpeed({
      speed: bot.sellSpeed + 1,
      interval,
      isNormal,
      isEntry,
    });
  const value =
    bot.brl *
    (1 - bot.buyProtection / 100) *
    getSpeed({
      speed: bot.buySpeed + 1,
      interval,
      isNormal,
      isEntry,
    });

  let buyMultiplier = Math.ceil(10 / value);
  let sellMultiplier = Math.ceil(10 / (quantity * upperLimit));
  const buyQuantity = normalizeValue({
    value: (buyMultiplier * value) / lowerLimit,
    decimal: qtdDecimal,
    isRoundUp: false,
  });
  const sellQuantity = normalizeValue({
    value: sellMultiplier * quantity,
    decimal: qtdDecimal,
    isRoundUp: false,
  });
  if (buyQuantity * lowerLimit < 10) {
    buyMultiplier += 1;
  }
  if (sellQuantity * upperLimit < 10) {
    sellMultiplier += 1;
  }

  const sellOrder: OrderEntry = {
    botId: String(bot._id),
    sessionId: String(bot.sessionId),
    userId: String(bot.userId),
    direction: "sell",
    interval,
    type: "entry",
    price: upperLimit,
    value: sellMultiplier * quantity * upperLimit,
    quantity: normalizeValue({
      value: sellMultiplier * quantity,
      decimal: qtdDecimal,
      isRoundUp: false,
    }),
    symbol: bot.symbol,
    period: bot.period + 20,
    apiKey: "",
    timeMultiplier: sellMultiplier,
  };

  const buyOrder: OrderEntry = {
    botId: String(bot._id),
    sessionId: String(bot.sessionId),
    userId: String(bot.userId),
    direction: "buy",
    interval,
    type: "entry",
    price: lowerLimit,
    value:
      normalizeValue({
        value: (buyMultiplier * value) / lowerLimit,
        decimal: qtdDecimal,
        isRoundUp: false,
      }) * lowerLimit,
    quantity: normalizeValue({
      value: (buyMultiplier * value) / lowerLimit,
      decimal: qtdDecimal,
      isRoundUp: false,
    }),
    symbol: bot.symbol,
    period: bot.period + 20,
    apiKey: "",
    timeMultiplier: buyMultiplier,
  };

  return [buyOrder, sellOrder];
}

async function calculateNormalOrder({
  bot,
  interval,
  upperLimit,
  lowerLimit,
  qtdDecimal,
  priceDecimal,
}: {
  bot: BotType;
  interval: IntervalType;
  upperLimit: number;
  lowerLimit: number;
  qtdDecimal: number;
  priceDecimal: number;
}) {
  const transactions = await TransactionModel.find({
    status: "open",
    botId: bot._id,
    interval,
  });
  const buyTransactions = transactions
    .filter((transaction) => transaction.direction === "buy")
    .sort((a, b) => a.price - b.price);
  const sellTransactions = transactions
    .filter((transaction) => transaction.direction === "sell")
    .sort((a, b) => b.price - a.price);
  const minProfit = 1 + (1 + intervalData[interval].profit * bot.profit) * tax;
  let buyQuantity = sellTransactions
    .filter((tx) => tx.price > lowerLimit * minProfit)
    .reduce((total, tx) => total + tx.quantity, 0);
  let sellQuantity = buyTransactions
    .filter((tx) => tx.price < upperLimit / minProfit)
    .reduce((total, tx) => total + tx.quantity, 0);
  buyQuantity = normalizeValue({
    value: buyQuantity,
    decimal: qtdDecimal,
    isRoundUp: false,
  });
  sellQuantity = normalizeValue({
    value: sellQuantity,
    decimal: qtdDecimal,
    isRoundUp: false,
  });
  let buyOrder: OrderEntry | null;
  let sellOrder: OrderEntry | null;
  if (sellQuantity * upperLimit < 10) {
    let totalQuantity = 0;
    let result = 0;
    let sellPrice = 0;
    for (const tx of buyTransactions) {
      totalQuantity += tx.quantity;
      sellPrice = normalizeValue({
        value: tx.price * minProfit,
        decimal: priceDecimal,
        isRoundUp: true,
      });
      result =
        sellPrice *
        normalizeValue({
          value: totalQuantity,
          decimal: qtdDecimal,
          isRoundUp: false,
        });
      if (result > 10) break;
    }
    if (result < 10) {
      sellOrder = null;
    } else {
      totalQuantity = normalizeValue({
        value: totalQuantity,
        decimal: qtdDecimal,
        isRoundUp: false,
      });
      sellOrder = {
        botId: String(bot._id),
        sessionId: String(bot.sessionId),
        userId: String(bot.userId),
        direction: "sell",
        interval,
        type: "normal",
        price: sellPrice,
        value: totalQuantity * sellPrice,
        quantity: totalQuantity,
        symbol: bot.symbol,
        period: bot.period + 20,
        apiKey: "",
      };
    }
  } else {
    sellOrder = {
      botId: String(bot._id),
      sessionId: String(bot.sessionId),
      userId: String(bot.userId),
      direction: "sell",
      interval,
      type: "normal",
      price: upperLimit,
      value: sellQuantity * upperLimit,
      quantity: sellQuantity,
      symbol: bot.symbol,
      period: bot.period + 20,
      apiKey: "",
    };
  }
  if (buyQuantity * lowerLimit < 10) {
    let totalQuantity = 0;
    let result = 0;
    let buyPrice = 0;
    for (const tx of sellTransactions) {
      totalQuantity += tx.quantity;
      buyPrice = normalizeValue({
        value: tx.price / minProfit,
        decimal: priceDecimal,
        isRoundUp: true,
      });
      result =
        buyPrice *
        normalizeValue({
          value: totalQuantity,
          decimal: qtdDecimal,
          isRoundUp: false,
        });
      if (result > 10) break;
    }
    if (result < 10) {
      buyOrder = null;
    } else {
      totalQuantity = normalizeValue({
        value: totalQuantity,
        decimal: qtdDecimal,
        isRoundUp: false,
      });
      buyOrder = {
        botId: String(bot._id),
        sessionId: String(bot.sessionId),
        userId: String(bot.userId),
        direction: "buy",
        interval,
        type: "normal",
        price: buyPrice,
        value: totalQuantity * buyPrice,
        quantity: totalQuantity,
        symbol: bot.symbol,
        period: bot.period + 20,
        apiKey: "",
      };
    }
  } else {
    buyOrder = {
      botId: String(bot._id),
      sessionId: String(bot.sessionId),
      userId: String(bot.userId),
      direction: "buy",
      interval,
      type: "normal",
      price: lowerLimit,
      value: buyQuantity * lowerLimit,
      quantity: buyQuantity,
      symbol: bot.symbol,
      period: bot.period + 20,
      apiKey: "",
    };
  }

  return [buyOrder, sellOrder];
}

async function calculateOrder({
  bot,
  interval,
  isEntry,
  isNormal,
}: {
  bot: BotType;
  interval: IntervalType;
  isEntry: boolean;
  isNormal: boolean;
}): Promise<(OrderEntry | null)[]> {
  let { upperLimit, lowerLimit, success, message } = await calculateBollLimits({
    symbol: bot.symbol,
    interval,
    period: bot.period + 20,
    width: 2.1 + (bot.width - 5) / 50,
  });
  if (!success) {
    throw new Error(message);
  }
  const { qtdDecimal, priceDecimal } = await getSymbolConfig(bot.symbol);
  upperLimit = normalizeValue({
    value: upperLimit,
    decimal: priceDecimal,
    isRoundUp: true,
  });
  lowerLimit = normalizeValue({
    value: lowerLimit,
    decimal: priceDecimal,
    isRoundUp: false,
  });
  if (isEntry) {
    return calculateEntryOrder({
      bot,
      interval,
      isEntry,
      isNormal,
      upperLimit,
      lowerLimit,
      qtdDecimal,
    });
  }
  return await calculateNormalOrder({
    bot,
    interval,
    upperLimit,
    lowerLimit,
    qtdDecimal,
    priceDecimal,
  });
}

async function sendOrders({
  activeOrder,
  order,
}: {
  activeOrder: any;
  order: OrderEntry;
}) {
  const { symbol } = order;
  const timeMultiplier = minutesSince({
    date: activeOrder?.lastExecutedTime,
    interval: intervalData[order.interval].timeMultiplier,
    period: order.period,
  });
  const isMultiplierInvalid =
    order.type === "entry"
      ? Math.floor(timeMultiplier) >= (order?.timeMultiplier || 1)
        ? false
        : true
      : false;

  if (isMultiplierInvalid) {
    console.log(
      "isMultiplierInvalid - ",
      Math.floor(timeMultiplier * 100) / 100,
      order?.timeMultiplier,
      order.type,
      order.interval,
      order.direction
    );
    return;
  }

  if (order.quantity * order.price < 10) {
    console.log(
      "less than 10 - ",
      order.quantity * order.price,
      order.type,
      order.interval,
      order.direction
    );
    return;
  }

  const realTimePrice = await getCurrentPrice(symbol);

  if (order.direction === "buy" && order.price < realTimePrice.price / 1.02) {
    console.log(
      "less than 2% - ",
      order.price,
      realTimePrice.price / 1.02,
      order.type,
      order.interval,
      order.direction
    );
    return;
  }

  if (order.direction === "sell" && order.price > realTimePrice.price * 1.02) {
    console.log(
      "higher than 2% - ",
      order.price,
      realTimePrice.price * 1.02,
      order.type,
      order.interval,
      order.direction
    );
    return;
  }

  const message = {
    action: "createOrder",
    payload: order,
  };
  if (!activeOrder || activeOrder.status === "closed") {
    logAndSendToQueue("socket", message);
    return;
  }
  const isUpdateQuantity = order.quantity !== activeOrder.quantity;
  if (isUpdateQuantity) {
    console.log("isUpdateQuantity", order);
    message.action = "cancelOrder";
    logAndSendToQueue("socket", message);
    return;
  }
  const isUpdatePrice =
    Math.abs(order.price - activeOrder.price) >= order.price * 0.001;
  if (isUpdatePrice) {
    console.log("isUpdatePrice", order);
    message.action = "replaceOrder";
    logAndSendToQueue("socket", message);
    return;
  }
}

export async function setEntryOrders(bot: BotType, apiKey: string) {
  const entryOrders = await OrderModel.find({
    botId: bot._id,
    type: "entry",
  });
  const promises: Promise<(OrderEntry | null)[]>[] = [];
  intervalList.forEach((interval) => {
    promises.push(
      calculateOrder({
        bot,
        interval: interval,
        isEntry: true,
        isNormal: false,
      })
    );
  });
  const calculatedOrders = await Promise.all(promises);
  const orders = calculatedOrders.flat().filter((order) => order !== null);
  orders.forEach((order) => {
    const activeOrder =
      entryOrders.find(
        (entryOrder) =>
          entryOrder.interval === order.interval &&
          entryOrder.direction === order.direction
      ) || null;
    order.apiKey = apiKey;
    sendOrders({ activeOrder, order });
  });
}

export async function setNormalOrders(bot: BotType, apiKey: string) {
  const normalOrders = await OrderModel.find({
    botId: bot._id,
    type: "normal",
  });
  const promises: Promise<(OrderEntry | null)[]>[] = [];
  intervalList.forEach((interval) => {
    promises.push(
      calculateOrder({
        bot,
        interval: interval,
        isEntry: false,
        isNormal: true,
      })
    );
  });
  const calculatedOrders = await Promise.all(promises);
  const orders = calculatedOrders.flat().filter((order) => order !== null);
  orders.forEach((order) => {
    const activeOrder =
      normalOrders.find(
        (entryOrder) =>
          entryOrder.interval === order.interval &&
          entryOrder.direction === order.direction
      ) || null;
    order.apiKey = apiKey;
    sendOrders({ activeOrder, order });
  });
}

export async function initializeMissingEntryOrders({
  botId,
  userId,
  sessionId,
  symbol,
  orders,
  period,
}: {
  botId: string;
  userId: string;
  sessionId: string;
  symbol: string;
  orders: any;
  period: number;
}): Promise<void> {
  const entryOrders = orders.filter((order: any) => order.type === "entry");
  const promises = [];
  for (const direction of ["buy", "sell"]) {
    for (const interval of intervalList) {
      const exists = entryOrders.find(
        (order: any) =>
          order.direction === direction && order.interval === interval
      );
      if (!exists) {
        promises.push(
          OrderModel.create({
            botId,
            userId,
            sessionId,
            direction,
            interval,
            symbol,
            type: "entry",
            status: "closed",
            lastExecutedTime: getLastExecutedTimeFromInterval(interval, period),
          })
        );
      }
    }
  }
  await Promise.all(promises);
}
