import { BinanceService } from "./app/binance/binance.service";
import { BinanceStats } from "./app/binance/binance.stats";

const symbol = "BTCBRL";
const interval = "1d";
const limit = 21;

const testKlines = async () => {
  const service = new BinanceService();
  const stats = new BinanceStats();
  const klines = await service.getKlines(symbol, interval, limit);
  if (klines.erro) {
    console.log(klines);
    return;
  }
  const klinesValue = stats.calculateKlineValue(klines?.data || []);
  const mean = stats.calculateAverage(klinesValue);
  const dp = stats.calculateStandardDeviation(klinesValue);
  console.log({ mean, dp });
};

testKlines();
