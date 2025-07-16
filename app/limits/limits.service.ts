// app/limits/limits.service.ts

import { getKlines } from "../binance/binance.service";
import { BinanceStats } from "../binance/binance.stats";
import { LimitResult } from "./limits.interface";

export async function calculateBollLimits({
  symbol,
  interval,
  period,
  width,
}: {
  symbol: string;
  interval: string;
  period: number;
  width: number;
}): Promise<LimitResult> {
  const klinesResult = await getKlines(symbol, interval, period + 20);
  if (klinesResult.erro || !klinesResult.data) {
    return {
      success: false,
      message: klinesResult.message || "Failed to fetch klines",
    };
  }
  const range = 2.1 + (width - 5) / 50;
  const stats = new BinanceStats();
  const klineValues = stats.calculateKlineValue(klinesResult.data);
  const mean = stats.calculateAverage(klineValues);
  const standardDeviation = stats.calculateStandardDeviation(klineValues);
  const upperLimit = mean + range * standardDeviation;
  const lowerLimit = mean - range * standardDeviation;

  return {
    upperLimit,
    lowerLimit,
  };
}
