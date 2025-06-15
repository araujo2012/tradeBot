import { Kline } from "../../binance.interface";
export class KlinesMock {
  static readonly validKlines: Kline[] = [
    ["0", "0", "0", "0", "0", "100", "0", "5000", "0", "0", "0", "0"],
    ["0", "0", "0", "0", "0", "50", "0", "2000", "0", "0", "0", "0"],
    ["0", "0", "0", "0", "0", "150", "0", "7500", "0", "0", "0", "0"],
  ];

  static readonly invalidKlines: Kline[] = [
    ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"], // all zeros → invalid
    ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"], // all zeros → invalid
  ];

  static readonly validKlineResults: (number | null)[] = [50, 40, 50];
}
