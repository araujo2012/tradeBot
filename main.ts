import express from "express";
import binanceRoutes from "./app/binance/binance.route";
import { connectToDatabase } from "./app/lib/database";
import { BinanceService } from "./app/binance/binance.service";
import { startBinanceSocket } from "./app/binance/binance.socket";
import { connectToRabbitMQ } from "./app/lib/rabbit";
import { SessionModel } from "./models/session";

await connectToRabbitMQ();
await connectToDatabase();

const app = express();
app.use(express.json());
app.use("/binance", binanceRoutes);

async function bootstrap() {
  const sessions = await SessionModel.find();

  await Promise.all(
    sessions.map(async (session) => {
      try {
        await startBinanceSocket({
          listenKey: session.listenKey,
          userId: session.userId.toString(),
          apiKey: session.apiKey,
          apiSecret: session.apiSecret,
        });
      } catch (err) {
        console.warn(
          `[Bootstrap] ListenKey falhou. Gerando nova para ${session._id}...`
        );

        const service = new BinanceService({
          apiKey: session.apiKey,
          apiSecret: session.apiSecret,
        });

        const newKeyResult = await service.getBinanceListenKey();
        if (!newKeyResult.error) {
          session.listenKey = newKeyResult.data.listenKey;
          await session.save();

          try {
            await startBinanceSocket({
              listenKey: session.listenKey,
              userId: session.userId.toString(),
              apiKey: session.apiKey,
              apiSecret: session.apiSecret,
            });
          } catch (err) {
            console.error(
              `[Bootstrap] Falha ao reconectar com novo listenKey para ${session._id}`
            );
          }
        } else {
          console.error(
            `[Bootstrap] Erro ao obter novo listenKey:`,
            newKeyResult.message
          );
        }
      }
    })
  );
}

bootstrap();
