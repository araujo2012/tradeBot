import { startBotJob, stopBotJob } from "./bot.jobs";
import { OrderModel } from "../../models/order";

// Função executada uma vez ao iniciar o bot
export async function onBotStart(botId: string, userId: string) {
  console.log(`Bot ${botId} iniciado em`, new Date().toISOString());

  // Buscar todas as ordens do bot
  const orders = await OrderModel.find({ botId, userId });
  console.log(`Encontradas ${orders.length} ordens para o bot ${botId}`);

  startBotJob(botId);
}

// Função executada uma vez ao parar o bot
export async function onBotStop(botId: string, userId: string) {
  console.log(`Bot ${botId} parado em`, new Date().toISOString());
  stopBotJob(botId);
}
