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
  const klinesResult = await getKlines(symbol, interval, period);
  if (klinesResult.erro || !klinesResult.data) {
    return {
      success: false,
      message: klinesResult.message || "Failed to fetch klines",
      upperLimit: Infinity,
      lowerLimit: 0,
    };
  }
  const stats = new BinanceStats();
  const klineValues = stats.calculateKlineValue(klinesResult.data);
  const mean = stats.calculateAverage(klineValues);
  const standardDeviation = stats.calculateStandardDeviation(klineValues);
  const upperLimit = mean + width * standardDeviation;
  const lowerLimit = mean - width * standardDeviation;

  return {
    success: true,
    upperLimit,
    lowerLimit,
  };
}
