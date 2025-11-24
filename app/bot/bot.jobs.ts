import { SessionModel } from "../../models/session";
import { BotDocument, BotModel } from "../../models/bot";
import { setOrders } from "../order/order.service";
import { OrderModel } from "../../models/order";
import { OrderDoc } from "../order/order.type";
import { handleExecutedOrder } from "../executedOrder/executedOrder.service";

export async function runBotJob(botId: string, apiKey: string) {
  const bot = await BotModel.findById(botId).lean();
  console.log(bot?.name);
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
