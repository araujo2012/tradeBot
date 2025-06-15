import { Kline } from "./binance.interface";

export class BinanceStats {
  calculateAverage(values: (number | null)[]): number {
    const filtered = values.filter((value): value is number => value !== null);
    if (filtered.length === 0) return 0;
    const sum = filtered.reduce((acc, val) => acc + val, 0);
    return sum / filtered.length;
  }

  calculateStandardDeviation(values: (number | null)[]): number {
    const filtered = values.filter((value): value is number => value !== null);
    if (filtered.length === 0) return 0;
    const average = this.calculateAverage(filtered);
    const variance =
      filtered.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) /
      filtered.length;
    return Math.sqrt(variance);
  }

  calculateKlineValue(klines: Kline[]): (number | null)[] {
    return klines.map((kline) => {
      const close = parseFloat(kline[5]);
      const volume = parseFloat(kline[7]);
      if (close === 0 || volume === 0) {
        return null;
      }
      return volume / close;
    });
  }
}
