// Função que será executada a cada minuto enquanto o bot estiver ativo
export function runBotJob(botId: string) {
  // Coloque aqui a lógica que deve rodar a cada minuto
  console.log(`Job do bot ${botId} executado em`, new Date().toISOString());
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
