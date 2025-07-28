import { SessionModel } from "../../models/session";
import { BotModel } from "../../models/bot";
import { setEntryOrders, setNormalOrders } from "../order/order.service";

export async function runBotJob(botId: string, apiKey: string) {
  const bot = await BotModel.findById(botId).lean();
  const session = await SessionModel.findById(bot?.sessionId);
  const canBotRun =
    bot && session && bot.status === "active" && session.status === "active";
  if (canBotRun) {
    setEntryOrders(bot, apiKey);
    setNormalOrders(bot, apiKey);
  }
}

const botIntervals: Record<string, NodeJS.Timeout> = {};

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
