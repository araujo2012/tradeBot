import { SessionModel } from "../../models/session";
import { BinanceService } from "../binance/binance.service";
import { startBinanceSocket } from "../binance/binance.socket";
import mongoose from "mongoose";

export async function bootstrapSessions() {
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
