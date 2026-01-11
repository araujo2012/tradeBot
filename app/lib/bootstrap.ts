import { logAndSendToQueue } from "./rabbit";
import { SessionModel } from "../../models/session";

export async function bootstrap() {
  try {
    const activeSessions = await SessionModel.find({
      status: { $in: ["active", "reconnecting"] },
    });
    console.log(`Encontradas ${activeSessions.length} sessões ativas.`);
    for (const session of activeSessions) {
      const message = {
        action: "startSession",
        sessionId: session._id,
        userId: session.userId,
      };
      session.status = "reconnecting";
      await session.save();
      logAndSendToQueue("socket", message);
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
