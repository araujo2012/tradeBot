import { startBotJob, stopBotJob } from "./bot.jobs";

// Função executada uma vez ao iniciar o bot
export async function onBotStart(botId: string) {
  console.log(`Bot ${botId} iniciado em`, new Date().toISOString());
  startBotJob(botId);
}

// Função executada uma vez ao parar o bot
export async function onBotStop(botId: string) {
  console.log(`Bot ${botId} parado em`, new Date().toISOString());
  stopBotJob(botId);
}
