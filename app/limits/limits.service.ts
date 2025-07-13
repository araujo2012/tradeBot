// app/limits/limits.service.ts

import { getKlines } from "../binance/binance.service";
import { BinanceStats } from "../binance/binance.stats";
import { LimitResult } from "./limits.interface";

export async function calculateBollLimits(
  symbol: string,
  interval: string,
  limit: number,
  range: number,
  apiKey: string,
  apiSecret: string
): Promise<LimitResult> {
  const klinesResult = await getKlines(
    symbol,
    interval,
    limit,
    apiKey,
    apiSecret
  );
  if (klinesResult.erro || !klinesResult.data) {
    return {
      success: false,
      message: klinesResult.message || "Failed to fetch klines",
    };
  }

  const stats = new BinanceStats();
  const klineValues = stats.calculateKlineValue(klinesResult.data);
  const mean = stats.calculateAverage(klineValues);
  const standardDeviation = stats.calculateStandardDeviation(klineValues);
  const upperLimit = mean + range * standardDeviation;
  const lowerLimit = mean - range * standardDeviation;

  return {
    success: true,
    upperLimit,
    lowerLimit,
  };
}
