import { SessionModel } from "../../models/session";
import { BotDocument, BotModel } from "../../models/bot";
import { setEntryOrders, setNormalOrders } from "../order/order.service";
import { OrderModel } from "../../models/order";
import { OrderDoc } from "../order/order.type";
import { handleExecutedOrder } from "app/executedOrder/executedOrder.service";

export async function runBotJob(botId: string, apiKey: string) {
  const bot = await BotModel.findById(botId).lean();
  console.log(bot?.name);
  const session = await SessionModel.findById(bot?.sessionId);
  const canBotRun =
    bot && session && bot.status === "active" && session.status === "active";
  if (canBotRun) {
    const orders = (await OrderModel.find({
      botId: botId,
      status: "executed",
    })) as OrderDoc[];
    if (orders.length > 0) {
      await handleExecutedOrders(orders, apiKey, bot);
    } else {
      setEntryOrders(bot, apiKey);
      setNormalOrders(bot, apiKey);
    }
  }
}

const botIntervals: Record<string, NodeJS.Timeout> = {};

function handleExecutedOrders(
  orders: OrderDoc[],
  apiKey: string,
  bot: BotDocument
) {
  const promises = [];
  for (const order of orders) {
    promises.push(
      handleExecutedOrder({
        order,
        apiKey,
        bot,
      })
    );
  }
  return Promise.all(promises);
}

export function startBotJob(botId: string, apiKey: string) {
  if (botIntervals[botId]) return; // já está rodando
  botIntervals[botId] = setInterval(() => runBotJob(botId, apiKey), 60 * 1000);
  console.log(`Bot ${botId} iniciado.`);
}

export function stopBotJob(botId: string) {
  if (botIntervals[botId]) {
    clearInterval(botIntervals[botId]);
    delete botIntervals[botId];
  }
}
