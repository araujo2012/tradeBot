import { BotModel } from "../../models/bot";
import { setEntryOrders } from "../order/order.service";

// Função que será executada a cada minuto para cada bot ativo
export async function runBotJob(botId: string) {
  const bot = await BotModel.findById(botId);
  if (bot && bot.status === "active") {
    console.log(`Job do bot ${botId} executado em`, new Date().toISOString());
    setEntryOrders(bot);
  }
}

// Gerenciador de intervalos por bot
const botIntervals: Record<string, NodeJS.Timeout> = {};

// Inicia o job periódico para um bot
export function startBotJob(botId: string) {
  if (botIntervals[botId]) return; // já está rodando
  botIntervals[botId] = setInterval(() => runBotJob(botId), 60 * 1000);
  // Executa imediatamente ao iniciar
  runBotJob(botId);
}

// Para o job periódico de um bot
export function stopBotJob(botId: string) {
  if (botIntervals[botId]) {
    clearInterval(botIntervals[botId]);
    delete botIntervals[botId];
  }
}
