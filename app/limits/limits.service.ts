// app/limits/limits.service.ts

import { BinanceService } from "../binance/binance.service";
import { BinanceStats } from "../binance/binance.stats";
import { LimitResult } from "./limits.interface";

export class LimitsService {
  private binanceService = new BinanceService();
  private stats = new BinanceStats();

  async calculateBollLimits(
    symbol: string,
    interval: string,
    limit: number,
    range: number
  ): Promise<LimitResult> {
    const klinesResult = await this.binanceService.getKlines(
      symbol,
      interval,
      limit
    );
    if (klinesResult.erro || !klinesResult.data) {
      return {
        success: false,
        message: klinesResult.message || "Failed to fetch klines",
      };
    }
    const klineValues = this.stats.calculateKlineValue(klinesResult.data);
    const mean = this.stats.calculateAverage(klineValues);
    const standardDeviation =
      this.stats.calculateStandardDeviation(klineValues);
    const upperLimit = mean + range * standardDeviation;
    const lowerLimit = mean - range * standardDeviation;
    return {
      success: true,
      upperLimit,
      lowerLimit,
    };
  }
}
