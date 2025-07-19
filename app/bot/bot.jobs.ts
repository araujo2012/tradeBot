import { BotModel } from "../../models/bot";
import { setEntryOrders } from "../order/order.service";

// Função que será executada a cada minuto para cada bot ativo
export async function runBotJob(botId: string, apiKey: string) {
  const bot = await BotModel.findById(botId);
  if (bot && bot.status === "active") {
    console.log(`Job do bot ${botId} executado em`, new Date().toISOString());
    setEntryOrders(bot, apiKey);
  }
}

// Gerenciador de intervalos por bot
const botIntervals: Record<string, NodeJS.Timeout> = {};

// Inicia o job periódico para um bot
export function startBotJob(botId: string, apiKey: string) {
  if (botIntervals[botId]) return; // já está rodando
  botIntervals[botId] = setInterval(() => runBotJob(botId, apiKey), 60 * 1000);
  console.log(`Bot ${botId} iniciado.`);
}

// Para o job periódico de um bot
export function stopBotJob(botId: string) {
  if (botIntervals[botId]) {
    clearInterval(botIntervals[botId]);
    delete botIntervals[botId];
  }
}
