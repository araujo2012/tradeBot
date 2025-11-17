import {
  calculateKlineValue,
  calculateAverage,
  calculateStandardDeviation,
} from "../binance.stats";
import { KlinesMock } from "./mocks/klines.mock";

describe("BinanceStats", () => {
  describe("calculateKlineValue", () => {
    it("should return correct volume/close values for valid klines", () => {
      const result = calculateKlineValue(KlinesMock.validKlines);
      expect(result).toEqual(KlinesMock.validKlineResults);
    });

    it("should return null for klines with zero close or volume", () => {
      const result = calculateKlineValue(KlinesMock.invalidKlines);
      expect(result.every((val: number | null) => val === null)).toBe(true);
    });

    it("should return empty array if input is empty", () => {
      const result = calculateKlineValue([]);
      expect(result).toEqual([]);
    });
  });

  describe("calculateAverage", () => {
    it("should calculate average ignoring nulls", () => {
      const values = [10, null, 20, null, 30];
      const result = calculateAverage(values);
      expect(result).toBe(20);
    });

    it("should return 0 for empty array or array with only nulls", () => {
      expect(calculateAverage([])).toBe(0);
      expect(calculateAverage([null, null])).toBe(0);
    });
  });

  describe("calculateStandardDeviation", () => {
    it("should calculate standard deviation ignoring nulls", () => {
      const values = [10, null, 20, null, 30];
      const result = calculateStandardDeviation(values);
      expect(result).toBeCloseTo(8.1649658093, 4);
    });

    it("should return 0 for empty array or array with only nulls", () => {
      expect(calculateStandardDeviation([])).toBe(0);
      expect(calculateStandardDeviation([null, null])).toBe(0);
    });
  });
});
