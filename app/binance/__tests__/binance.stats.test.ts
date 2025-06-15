import { BinanceStats } from "../binance.stats";
import { KlinesMock } from "./mocks/klines.mock";

describe("BinanceStats", () => {
  describe("calculateKlineValue", () => {
    it("should return correct volume/close values for valid klines", () => {
      const result = BinanceStats.calculateKlineValue(KlinesMock.validKlines);
      expect(result).toEqual(KlinesMock.validKlineResults);
    });

    it("should return null for klines with zero close or volume", () => {
      const result = BinanceStats.calculateKlineValue(KlinesMock.invalidKlines);
      expect(result.every((val) => val === null)).toBe(true);
    });

    it("should return empty array if input is empty", () => {
      const result = BinanceStats.calculateKlineValue([]);
      expect(result).toEqual([]);
    });
  });

  describe("calculateAverage", () => {
    it("should calculate average ignoring nulls", () => {
      const values = [10, null, 20, null, 30];
      const result = BinanceStats.calculateAverage(values);
      expect(result).toBe(20);
    });

    it("should return 0 for empty array or array with only nulls", () => {
      expect(BinanceStats.calculateAverage([])).toBe(0);
      expect(BinanceStats.calculateAverage([null, null])).toBe(0);
    });
  });

  describe("calculateStandardDeviation", () => {
    it("should calculate standard deviation ignoring nulls", () => {
      const values = [10, null, 20, null, 30];
      const result = BinanceStats.calculateStandardDeviation(values);
      expect(result).toBeCloseTo(8.1649658093, 4);
    });

    it("should return 0 for empty array or array with only nulls", () => {
      expect(BinanceStats.calculateStandardDeviation([])).toBe(0);
      expect(BinanceStats.calculateStandardDeviation([null, null])).toBe(0);
    });
  });
});
