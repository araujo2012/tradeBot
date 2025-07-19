import { calculateBollLimits } from "../limits/limits.service";
import { OrderModel } from "../../models/order";
import { intervalList, intervalData } from "./order.constants";
import type { BotType } from "../bot/bot.type";
import type { OrderEntry, IntervalType, OrderDoc } from "./order.type";
import { getSpeed, getSymbolConfig, minutesSince } from "./order.utils";
import { getRabbitChannel } from "../lib/rabbit";
import { getCurrentPrice } from "../binance/binance.service";

export async function calculateEntryOrder({
  bot,
  interval,
}: {
  bot: BotType;
  interval: IntervalType;
}): Promise<OrderEntry[]> {
  const { upperLimit, lowerLimit, success, message } =
    await calculateBollLimits({
      symbol: bot.symbol,
      interval,
      period: bot.period + 20,
      width: 2.1 + (bot.width - 5) / 50,
    });
  if (!success) {
    throw new Error(message);
  }
  const quantity =
    bot.crypto *
    (1 - bot.sellProtection / 100) *
    getSpeed({ speed: bot.sellSpeed + 1, interval });
  const value =
    bot.brl *
    (1 - bot.buyProtection / 100) *
    getSpeed({ speed: bot.buySpeed + 1, interval });

  const sellOrder: OrderEntry = {
    botId: String(bot._id),
    sessionId: String(bot.sessionId),
    userId: String(bot.userId),
    direction: "sell",
    interval,
    type: "entry",
    price: upperLimit,
    value: quantity * upperLimit,
    quantity,
    symbol: bot.symbol,
    period: bot.period + 20,
    apiKey: "",
  };

  const buyOrder: OrderEntry = {
    botId: String(bot._id),
    sessionId: String(bot.sessionId),
    userId: String(bot.userId),
    direction: "buy",
    interval,
    type: "entry",
    price: lowerLimit,
    value,
    quantity: value / lowerLimit,
    symbol: bot.symbol,
    period: bot.period + 20,
    apiKey: "",
  };

  return [buyOrder, sellOrder];
}

export async function sendOrders({
  activeOrder,
  order,
}: {
  activeOrder: any;
  order: OrderEntry;
}) {
  const { symbol, quantity, price, direction } = order;
  const symbolConfig = await getSymbolConfig(symbol);
  const { priceDecimal, qtdDecimal } = symbolConfig;
  order.price =
    (direction === "buy"
      ? Math.floor(price * Math.pow(10, priceDecimal))
      : Math.ceil(price * Math.pow(10, priceDecimal))) /
    Math.pow(10, priceDecimal);
  order.quantity =
    Math.floor(quantity * Math.pow(10, qtdDecimal)) / Math.pow(10, qtdDecimal);
  const value = order.price * order.quantity;
  const qtdMultiplier = activeOrder?.lastExecutedTime
    ? Math.min(
        value >= 10 ? 1 : Math.ceil(10 / value),
        minutesSince({
          date: activeOrder?.lastExecutedTime || new Date(),
          interval: intervalData[order.interval].timeMultiplier,
          period: order.period,
        })
      )
    : 1;
  order.quantity = qtdMultiplier * order.quantity;
  order.value = order.price * order.quantity;

  const realTimePrice = await getCurrentPrice(symbol);

  if (order.direction === "buy" && order.price < realTimePrice.price * 0.98) {
    console.log("price more then 2% lower", {
      order,
      realTimePrice: realTimePrice.price,
    });
    return;
  }

  if (order.direction === "sell" && order.price > realTimePrice.price * 1.02) {
    console.log("price 2% more higher", {
      order,
      realTimePrice: realTimePrice.price,
    });
    return;
  }
  if (order.quantity * order.price < 10) {
    console.log("price lower than 10", { order });
    return;
  }
  //remover
  if (order.direction === "buy") {
    order.price = 600000 + intervalData[order.interval].entry;
  }
  const channel = getRabbitChannel();
  const message = {
    action: "createOrder",
    payload: order,
  };
  if (!activeOrder || ["closed", "pending"].includes(activeOrder.status)) {
    channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    return;
  }
  const isUpdateQuantity = order.quantity !== activeOrder.quantity;
  if (isUpdateQuantity) {
    return;
  }
  const isUpdatePrice =
    Math.abs(order.price - activeOrder.price) >= order.price * 0.001;
  if (isUpdatePrice) {
    return;
  }
}

export async function setEntryOrders(bot: BotType, apiKey: string) {
  const entryOrders = await OrderModel.find({
    botId: bot._id,
    type: "entry",
  });
  const promises: Promise<OrderEntry[]>[] = [];
  intervalList.forEach((interval) => {
    promises.push(
      calculateEntryOrder({
        bot,
        interval: interval,
      })
    );
  });
  const calculatedOrders = await Promise.all(promises);
  const orders = calculatedOrders.flat();
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

export async function executedOrders(order: OrderDoc) {}
