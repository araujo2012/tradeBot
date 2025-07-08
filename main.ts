import express from "express";
import binanceRoutes from "./app/binance/binance.route";
import { connectToDatabase } from "./app/lib/database";
import { BinanceService } from "./app/binance/binance.service";
import { startBinanceSocket } from "./app/binance/binance.socket";
import { UserModel } from "./models/user";
import { connectToRabbitMQ } from "./app/lib/rabbit";

(async () => {
  await connectToDatabase();
  await connectToRabbitMQ();
})();

const app = express();
app.use(express.json());

app.use("/binance", binanceRoutes);

const username = "nome-do-usuario"; // substitua conforme necessário

const startSocketForUser = async (username: string) => {
  await connectToDatabase();

  const user = await UserModel.findOne({ username });

  if (!user || !user.apiKey || !user.apiSecret) {
    console.error("Usuário não encontrado ou sem credenciais.");
    return;
  }

  const service = new BinanceService({
    apiKey: user.apiKey,
    apiSecret: user.apiSecret,
  });

  const listenKeyResult = await service.getBinanceListenKey();

  if (listenKeyResult.error) {
    console.error("Erro ao obter listenKey:", listenKeyResult.message);
    return;
  }

  const listenKey = listenKeyResult.data.listenKey;
  console.log("ListenKey gerada:", listenKey);

  startBinanceSocket(listenKey, username);
};

startSocketForUser("araujo2012");
