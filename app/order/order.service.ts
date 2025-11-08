import { calculateBollLimits } from "../limits/limits.service";
import { OrderModel } from "../../models/order";
import { intervalList, intervalData, tax, orderRange } from "./order.constants";
import type { BotType } from "../bot/bot.type";
import type { OrderEntry, IntervalType, ActiveOrder } from "./order.type";
import {
  getLastExecutedTimeFromInterval,
  getSpeed,
  getSymbolConfig,
  minutesSince,
  normalizeValue,
  calculateWeightedPriceStats,
  probabilityOfZ,
} from "./order.utils";
import { logAndSendToQueue } from "../lib/rabbit";
import { getCurrentPrice } from "../binance/binance.service";
import { TransactionModel } from "../../models/transaction";

interface TransactionStats {
  weightedAverage: number;
  weightedStdDev: number;
  totalQuantity: number;
}

interface EntryStats {
  quantity: number;
  value: number;
  buyPrice: number;
  sellPrice: number;
}

function handleOutOfRangeOrder({
  transactions,
  minProfit,
  priceDecimal,
  qtdDecimal,
  entryPrice,
  entryValue,
  isSell,
}: {
  transactions: any[];
  minProfit: number;
  priceDecimal: number;
  qtdDecimal: number;
  entryPrice: number;
  entryValue: number;
  isSell: boolean;
}) {
  let totalQuantity = 0;
  let result = 0;
  let price = 0;
  let limitPrice = isSell ? 0 : Infinity;
  let entryQtd = 0;
  for (const tx of transactions) {
    const profitPrice = normalizeValue({
      value: tx.price * (isSell ? minProfit : 1 / minProfit),
      decimal: priceDecimal,
      isRoundUp: true,
    });
    const canExecuteEntry = isSell
      ? profitPrice > entryPrice
      : profitPrice < entryPrice;
    if (canExecuteEntry) {
      const haveToExit = isSell
        ? entryPrice > limitPrice
        : entryPrice < limitPrice;
      if (result > 10 && haveToExit) {
        break;
      }
      price = entryPrice;
      totalQuantity += isSell ? entryValue : entryValue / price;
      entryQtd = isSell ? entryValue : entryValue / price;
      result =
        price *
        normalizeValue({
          value: totalQuantity,
          decimal: qtdDecimal,
          isRoundUp: false,
        });
      if (result > 10 && (limitPrice === 0 || limitPrice === Infinity)) {
        limitPrice = price * (isSell ? orderRange : 1 / orderRange);
      }
    }
    const haveToExit = isSell
      ? profitPrice > limitPrice
      : profitPrice < limitPrice;
    if (result > 10 && haveToExit) {
      break;
    }
    totalQuantity += tx.quantity - tx.executedQtd;
    price = profitPrice;
    result =
      price *
      normalizeValue({
        value: totalQuantity,
        decimal: qtdDecimal,
        isRoundUp: false,
      });
    if (result > 10 && (limitPrice === 0 || limitPrice === Infinity)) {
      limitPrice = price * (isSell ? orderRange : 1 / orderRange);
    }
  }
  if (result < 10) {
    return null;
  } else {
    totalQuantity = normalizeValue({
      value: totalQuantity,
      decimal: qtdDecimal,
      isRoundUp: false,
    });
    return { totalQuantity, price, entryQtd };
  }
}

function calculateEntryStats({
  bot,
  interval,
  upperLimit,
  lowerLimit,
  qtdDecimal,
  activeOrders,
  buyStats,
  sellStats,
  realTimePrice,
}: {
  bot: BotType;
  interval: IntervalType;
  upperLimit: number;
  lowerLimit: number;
  qtdDecimal: number;
  activeOrders: ActiveOrder[];
  buyStats: TransactionStats;
  sellStats: TransactionStats;
  realTimePrice: number;
}) {
  const Nbuy = probabilityOfZ({
    mean: buyStats.weightedAverage,
    stdDev: buyStats.weightedStdDev,
    z: realTimePrice,
    direction: "buy",
  });
  const Nsell = probabilityOfZ({
    mean: sellStats.weightedAverage,
    stdDev: sellStats.weightedStdDev,
    z: realTimePrice,
    direction: "sell",
  });
  const targetCrypto = bot.cryptoTarget / realTimePrice;
  const maxCrypto = bot.limit / realTimePrice;
  const totalCrypto = buyStats.totalQuantity + bot.crypto;
  const targetBuy =
    targetCrypto === totalCrypto
      ? 0.5
      : targetCrypto > totalCrypto
      ? 0.5 + (1 - totalCrypto / targetCrypto) / 2
      : 0.5 - (totalCrypto - targetCrypto) / (maxCrypto - targetCrypto) / 2;
  const targetSell = 1 - targetBuy;
  const buyEntryP = (1 - bot.buyProtection / 100) * Nbuy * targetBuy;
  const sellEntryP = (1 - bot.sellProtection / 100) * Nsell * targetSell;
  const quantity =
    bot.crypto *
    sellEntryP *
    getSpeed({
      speed: bot.sellSpeed + 1,
      interval,
      isNormal: false,
      isEntry: true,
    });
  const value =
    bot.brl *
    buyEntryP *
    getSpeed({
      speed: bot.buySpeed + 1,
      interval,
      isNormal: false,
      isEntry: true,
    });
  let buyMultiplier = Math.ceil(10 / value);
  let sellMultiplier = Math.ceil(10 / (quantity * realTimePrice));
  const priceStd = (upperLimit - lowerLimit) / 2;
  const activeSellOrder = activeOrders.find((a) => a.direction === "sell");
  const activeBuyOrder = activeOrders.find((a) => a.direction === "buy");
  const timeSell = minutesSince({
    date: activeSellOrder?.lastExecutedTime,
    interval: intervalData[interval].timeMultiplier,
    period: bot.period + 20,
  });
  const timeBuy = minutesSince({
    date: activeBuyOrder?.lastExecutedTime,
    interval: intervalData[interval].timeMultiplier,
    period: bot.period + 20,
  });
  let sellPrice =
    timeSell === 0
      ? Infinity
      : upperLimit - priceStd + (sellMultiplier * priceStd) / timeSell;
  let buyPrice =
    timeBuy === 0
      ? 0
      : lowerLimit + priceStd - (buyMultiplier * priceStd) / timeBuy;
  if (buyPrice < 0) {
    buyPrice = 0;
  }
  if (sellPrice < upperLimit) {
    sellPrice = upperLimit;
  }
  if (buyPrice > lowerLimit) {
    buyPrice = lowerLimit;
  }
  return { quantity, value, buyPrice, sellPrice };
}

function calculateNormalOrder({
  bot,
  interval,
  upperLimit,
  lowerLimit,
  qtdDecimal,
  priceDecimal,
  entryStats,
  buyTransactions,
  sellTransactions,
}: {
  bot: BotType;
  interval: IntervalType;
  upperLimit: number;
  lowerLimit: number;
  qtdDecimal: number;
  priceDecimal: number;
  entryStats: EntryStats;
  buyTransactions: any[];
  sellTransactions: any[];
}) {
  const minProfit = 1 + (1 + intervalData[interval].profit * bot.profit) * tax;
  let buyQuantity = sellTransactions
    .filter((tx) => tx.price > lowerLimit * minProfit)
    .reduce((total, tx) => total + tx.quantity - tx.executedQtd, 0);
  let sellQuantity = buyTransactions
    .filter((tx) => tx.price < upperLimit / minProfit)
    .reduce((total, tx) => total + tx.quantity - tx.executedQtd, 0);
  let entryBuy =
    entryStats.buyPrice === lowerLimit
      ? entryStats.value / lowerLimit - buyQuantity
      : 0;
  let entrySell =
    entryStats.sellPrice === upperLimit
      ? entryStats.quantity - sellQuantity
      : 0;
  if (entryBuy < 0) {
    entryBuy = 0;
  }
  if (entrySell < 0) {
    entrySell = 0;
  }
  buyQuantity = normalizeValue({
    value: buyQuantity + entryBuy,
    decimal: qtdDecimal,
    isRoundUp: false,
  });
  sellQuantity = normalizeValue({
    value: sellQuantity + entrySell,
    decimal: qtdDecimal,
    isRoundUp: false,
  });
  let buyOrder: OrderEntry | null = {
    botId: String(bot._id),
    sessionId: String(bot.sessionId),
    userId: String(bot.userId),
    direction: "buy",
    interval,
    price: lowerLimit,
    value: buyQuantity * lowerLimit,
    quantity: buyQuantity,
    entryQtd: entryBuy,
    maxEntry: entryStats.value,
    symbol: bot.symbol,
    period: bot.period + 20,
    apiKey: "",
  };
  let sellOrder: OrderEntry | null = {
    botId: String(bot._id),
    sessionId: String(bot.sessionId),
    userId: String(bot.userId),
    direction: "sell",
    interval,
    price: upperLimit,
    value: sellQuantity * upperLimit,
    quantity: sellQuantity,
    entryQtd: entrySell,
    maxEntry: entryStats.quantity,
    symbol: bot.symbol,
    period: bot.period + 20,
    apiKey: "",
  };
  if (sellQuantity * upperLimit < 10) {
    const result = handleOutOfRangeOrder({
      transactions: sellTransactions,
      minProfit,
      priceDecimal,
      qtdDecimal,
      entryPrice: entryStats.sellPrice,
      entryValue: entryStats.quantity,
      isSell: true,
    });
    if (!result) {
      sellOrder = null;
    } else {
      const { totalQuantity, price, entryQtd } = result;
      sellOrder.price = price;
      sellOrder.value = totalQuantity * price;
      sellOrder.quantity = totalQuantity;
      sellOrder.entryQtd = entryQtd;
    }
  }
  if (buyQuantity * lowerLimit < 10) {
    const result = handleOutOfRangeOrder({
      transactions: buyTransactions,
      minProfit,
      priceDecimal,
      qtdDecimal,
      entryPrice: entryStats.buyPrice,
      entryValue: entryStats.value,
      isSell: false,
    });
    if (!result) {
      buyOrder = null;
    } else {
      const { totalQuantity, price, entryQtd } = result;
      buyOrder.price = price;
      buyOrder.value = totalQuantity * price;
      buyOrder.quantity = totalQuantity;
      buyOrder.entryQtd = entryQtd;
    }
  }
  return [buyOrder, sellOrder];
}

async function calculateOrder({
  bot,
  interval,
  buyStats,
  sellStats,
  buyTransactions,
  sellTransactions,
  activeOrders,
  realTimePrice,
}: {
  bot: BotType;
  interval: IntervalType;
  buyStats: TransactionStats;
  sellStats: TransactionStats;
  buyTransactions: any[];
  sellTransactions: any[];
  activeOrders: ActiveOrder[];
  realTimePrice: number;
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
  const entryStats = calculateEntryStats({
    bot,
    interval,
    upperLimit,
    lowerLimit,
    qtdDecimal,
    activeOrders,
    buyStats,
    sellStats,
    realTimePrice,
  });
  return calculateNormalOrder({
    bot,
    interval,
    upperLimit,
    lowerLimit,
    qtdDecimal,
    priceDecimal,
    entryStats,
    buyTransactions,
    sellTransactions,
  });
}

async function sendOrders({
  activeOrder,
  order,
}: {
  activeOrder: ActiveOrder | null;
  order: OrderEntry;
}) {
  const { symbol } = order;

  if (order.quantity * order.price < 10) {
    console.log(
      "less than 10 - ",
      order.quantity * order.price,
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
    message.action = "replaceOrder";
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

export async function setOrders(bot: BotType, apiKey: string) {
  const activeOrders = (await OrderModel.find({
    botId: bot._id,
  })
    .select("interval direction price quantity lastExecutedTime status")
    .lean()) as ActiveOrder[];
  const transactions = await TransactionModel.find({
    status: "open",
    botId: bot._id,
  })
    .sort({ price: 1 })
    .select("direction price quantity executedQtd")
    .lean();
  const buyTransactions = transactions.filter(
    (transaction) => transaction.direction === "buy"
  );
  const sellTransactions = transactions
    .filter((transaction) => transaction.direction === "sell")
    .reverse();
  const buyStats = calculateWeightedPriceStats(
    buyTransactions.map((transaction) => ({
      price: transaction.price,
      quantity: transaction.quantity - transaction.executedQtd,
    }))
  );
  const sellStats = calculateWeightedPriceStats(
    sellTransactions.map((transaction) => ({
      price: transaction.price,
      quantity: transaction.quantity - transaction.executedQtd,
    }))
  );
  const realTimePrice = await getCurrentPrice(bot.symbol);
  if (realTimePrice.erro) {
    console.log("realTimePrice", realTimePrice.message);
    return;
  }
  const promises: Promise<(OrderEntry | null)[]>[] = [];
  intervalList.forEach((interval) => {
    promises.push(
      calculateOrder({
        bot,
        interval: interval,
        buyStats,
        sellStats,
        buyTransactions,
        sellTransactions,
        activeOrders: activeOrders.filter(
          (activeOrder) => activeOrder.interval === interval
        ),
        realTimePrice: realTimePrice?.price || 0,
      })
    );
  });
  const calculatedOrders = await Promise.all(promises);
  const orders = calculatedOrders.flat().filter((order) => order !== null);
  orders.forEach((order) => {
    const activeOrder =
      activeOrders.find(
        (activeOrder) =>
          activeOrder.interval === order.interval &&
          activeOrder.direction === order.direction
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

export async function getActiveOrdersByUser(userId: string) {
  return OrderModel.find({ userId, status: "active" }).select(
    "symbol quantity price"
  );
}
