import express, { RequestHandler } from "express";
import binanceRoutes from "./app/binance/binance.route";
import authRoutes from "./app/auth/auth.routes";
import userRoutes from "./app/user/user.routes";
import { authMiddleware } from "./app/auth/auth.middleware";
import { connectToDatabase } from "./app/lib/database";
import { connectToRabbitMQ } from "./app/lib/rabbit";
import { SessionModel } from "./models/session";
import { BinanceService } from "./app/binance/binance.service";
import { startBinanceSocket } from "./app/binance/binance.socket";
import mongoose from "mongoose";

async function initApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/users", authMiddleware as RequestHandler, userRoutes);
  app.use("/binance", authMiddleware as RequestHandler, binanceRoutes);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
}

async function bootstrapSessions() {
  const sessions = await SessionModel.find();

  await Promise.all(
    sessions.map(async (session) => {
      const sessionId = (session._id as mongoose.Types.ObjectId).toString();
      const userId = session.userId.toString();

      const socketParams = {
        listenKey: session.listenKey,
        userId,
        apiKey: session.apiKey,
        apiSecret: session.apiSecret,
      };

      try {
        await startBinanceSocket(socketParams);
        console.log(`[Bootstrap] Socket iniciado para sessão ${sessionId}`);
      } catch (err) {
        console.warn(
          `[Bootstrap] ListenKey inválido para ${sessionId}. Tentando regenerar...`
        );

        const service = new BinanceService({
          apiKey: session.apiKey,
          apiSecret: session.apiSecret,
        });

        const newKeyResult = await service.getBinanceListenKey();

        if (newKeyResult.error) {
          console.error(
            `[Bootstrap] Erro ao gerar novo listenKey para ${sessionId}:`,
            newKeyResult.message
          );
          return;
        }

        session.listenKey = newKeyResult.data.listenKey;
        await session.save();

        try {
          await startBinanceSocket({
            ...socketParams,
            listenKey: session.listenKey,
          });
          console.log(
            `[Bootstrap] Reconectado com novo listenKey para ${sessionId}`
          );
        } catch (err) {
          console.error(
            `[Bootstrap] Falha ao reconectar com novo listenKey para ${sessionId}`
          );
        }
      }
    })
  );
}

(async () => {
  try {
    await connectToRabbitMQ();
    await connectToDatabase();
    await initApp();
    await bootstrapSessions();
  } catch (err) {
    console.error("❌ Falha na inicialização da aplicação:", err);
    process.exit(1);
  }
})();
