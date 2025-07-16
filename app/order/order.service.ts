import { calculateBollLimits } from "../limits/limits.service";
import { OrderModel } from "../../models/order";
import { directionList, intervalList } from "./order.constants";
import type { BotType } from "../bot/bot.type";
import type { OrderEntry, CalculateEntryOrderParams } from "./order.type";
import { getSpeed } from "./order.utils";

export async function calculateEntryOrder({
  bot,
  interval,
}: CalculateEntryOrderParams): Promise<OrderEntry[]> {
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
  };

  return [buyOrder, sellOrder];
}

export async function setEntryOrders(bot: BotType) {
  const promises: Promise<OrderEntry[]>[] = [];
  intervalList.forEach((interval) => {
    promises.push(
      calculateEntryOrder({
        bot,
        interval,
      })
    );
  });
  const results = await Promise.all(promises);
  const orders = results.flat();
  console.log({ orders });
}
