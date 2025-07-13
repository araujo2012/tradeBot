import { SessionModel } from "../../models/session";
import { getBinanceListenKey } from "../binance/binance.service";
import { startBinanceSocket } from "../binance/binance.socket";
import mongoose from "mongoose";

export async function bootstrapSessions() {
  const sessions = await SessionModel.find();

  await Promise.all(
    sessions.map(async (session) => {
      const sessionId = (session._id as mongoose.Types.ObjectId).toString();

      // Pular sessões inativas ou sem listenKey
      if (session.status === "inactive") {
        console.log(`[Bootstrap] Sessão ${sessionId} está inativa, pulando...`);
        return;
      }

      if (!session.listenKey) {
        console.log(
          `[Bootstrap] Sessão ${sessionId} sem listenKey, pulando...`
        );
        return;
      }

      const socketParams = {
        listenKey: session.listenKey,
        sessionId,
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

        const newKeyResult = await getBinanceListenKey(
          session.apiKey,
          session.apiSecret
        );

        if (newKeyResult.error) {
          console.error(
            `[Bootstrap] Erro ao gerar novo listenKey para ${sessionId}:`,
            newKeyResult.message
          );
          // Marcar sessão como inativa se não conseguir gerar novo listenKey
          await SessionModel.findByIdAndUpdate(sessionId, {
            status: "inactive",
          });
          console.log(
            `[Bootstrap] Sessão ${sessionId} marcada como inativa - falha ao gerar listenKey`
          );
          return;
        }

        session.listenKey = newKeyResult.data.listenKey;
        await session.save();

        try {
          await startBinanceSocket({
            ...socketParams,
            listenKey: newKeyResult.data.listenKey,
          });
          console.log(
            `[Bootstrap] Reconectado com novo listenKey para ${sessionId}`
          );
        } catch (err) {
          console.error(
            `[Bootstrap] Falha ao reconectar com novo listenKey para ${sessionId}`
          );
          // Marcar sessão como inativa se não conseguir conectar com novo listenKey
          await SessionModel.findByIdAndUpdate(sessionId, {
            status: "inactive",
          });
          console.log(
            `[Bootstrap] Sessão ${sessionId} marcada como inativa - falha na reconexão`
          );
        }
      }
    })
  );
}
