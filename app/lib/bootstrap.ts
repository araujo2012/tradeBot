import { getRabbitChannel } from "./rabbit";
import { SessionModel } from "../../models/session";

export async function bootstrap() {
  try {
    const channel = getRabbitChannel();

    // Buscar todas as sessões ativas
    const activeSessions = await SessionModel.find({ status: "active" });
    console.log(`Encontradas ${activeSessions.length} sessões ativas.`);

    for (const session of activeSessions) {
      const message = {
        action: "startSession",
        sessionId: session._id,
        userId: session.userId,
      };
      channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      console.log(
        `Sessão ${session._id} do usuário ${session.userId} enviada para fila.`
      );
    }

    console.log("Bootstrap finalizado.");
  } catch (err) {
    console.error("Erro no bootstrap:", err);
    process.exit(1);
  }
}

// Executa automaticamente se chamado diretamente
if (require.main === module) {
  bootstrap();
}
