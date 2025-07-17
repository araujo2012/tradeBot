import { calculateBollLimits } from "../limits/limits.service";
import { OrderModel } from "../../models/order";
import { intervalList } from "./order.constants";
import type { BotType } from "../bot/bot.type";
import type { OrderEntry, IntervalType, OrderDoc } from "./order.type";
import { getSpeed } from "./order.utils";
import { redis } from "../lib/redis";
import { getRabbitChannel } from "../lib/rabbit";
import { getCurrentPrice } from "../binance/binance.service";

export async function calculateEntryOrder({
  bot,
  interval,
}: {
  bot: BotType;
  interval: IntervalType;
}): Promise<OrderEntry[]> {
  const { upperLimit, lowerLimit } = await calculateBollLimits({
    symbol: bot.symbol,
    interval,
    period: bot.period,
    width: bot.width,
  });

  const sellOrder: OrderEntry = {
    botId: String(bot._id),
    direction: "sell",
    interval,
    type: "entry",
    price: typeof upperLimit === "number" ? upperLimit : 0,
    quantity:
      bot.crypto *
      (1 - bot.sellProtection / 100) *
      getSpeed({ speed: bot.sellSpeed, interval }),
    symbol: bot.symbol,
  };
  const buyOrder: OrderEntry = {
    botId: String(bot._id),
    direction: "buy",
    interval,
    type: "entry",
    price: typeof lowerLimit === "number" ? lowerLimit : 0,
    quantity:
      bot.brl *
      (1 - bot.buyProtection / 100) *
      getSpeed({ speed: bot.buySpeed, interval }),
    symbol: bot.symbol,
  };

  return [buyOrder, sellOrder];
}

export async function sendOrders({
  activeOrder,
  order,
}: {
  activeOrder: OrderDoc | null;
  order: OrderEntry;
}) {
  const realTimePrice = await getCurrentPrice(order.symbol);

  if (order.direction === "buy" && order.price < realTimePrice.price * 0.98) {
    return;
  }

  if (order.direction === "sell" && order.price > realTimePrice.price * 1.02) {
    return;
  }
  if (order.quantity === 0) {
    return;
  }

  const channel = getRabbitChannel();
  const message = {
    action: "createOrder",
    payload: order,
  };
  if (!activeOrder) {
    channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    return;
  }
  if (activeOrder.status === "closed") {
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

export async function setEntryOrders(bot: BotType) {
  const redisKey = `orders-${bot._id}`;
  let entryOrders: OrderDoc[];
  const cached = await redis.get(redisKey);
  if (cached) {
    entryOrders = JSON.parse(cached);
  } else {
    entryOrders = await OrderModel.find({
      botId: bot._id,
      type: "entry",
      status: { $in: ["active", "executed"] },
    });
    await redis.set(redisKey, JSON.stringify(entryOrders), "EX", 60 * 60);
  }
  const promises: Promise<OrderEntry[]>[] = [];
  intervalList.forEach((interval) => {
    promises.push(
      calculateEntryOrder({
        bot,
        interval: interval as IntervalType,
      })
    );
  });
  const results = await Promise.all(promises);
  const orders = results.flat();
  orders.forEach((order) => {
    const activeOrder =
      entryOrders.find(
        (entryOrder) =>
          entryOrder.interval === order.interval &&
          entryOrder.direction === order.direction
      ) || null;
    sendOrders({ activeOrder, order });
  });
}
