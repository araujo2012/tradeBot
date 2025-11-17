import { calculateBollLimits } from "../limits.service";
import * as binanceService from "../../binance/binance.service";
import * as binanceStats from "../../binance/binance.stats";
import { KlinesMock } from "../../binance/__tests__/mocks/klines.mock";

jest.mock("../../binance/binance.service");
jest.mock("../../binance/binance.stats");

describe("LimitsService", () => {
  const mockGetKlines = jest.spyOn(binanceService, "getKlines");
  const mockCalculateKlineValue = jest.spyOn(
    binanceStats,
    "calculateKlineValue"
  );
  const mockCalculateAverage = jest.spyOn(binanceStats, "calculateAverage");
  const mockCalculateStandardDeviation = jest.spyOn(
    binanceStats,
    "calculateStandardDeviation"
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return upper and lower limits correctly", async () => {
    mockGetKlines.mockResolvedValue({
      erro: false,
      data: KlinesMock.validKlines,
    });

    mockCalculateKlineValue.mockReturnValue(KlinesMock.validKlineResults);
    mockCalculateAverage.mockReturnValue(46.66);
    mockCalculateStandardDeviation.mockReturnValue(5.77);

    const result = await calculateBollLimits({
      symbol: "BTCBRL",
      interval: "1m",
      period: 3,
      width: 2,
    });

    expect(result.success).toBe(true);
    expect(result.upperLimit).toBeCloseTo(46.66 + 2 * 5.77, 2);
    expect(result.lowerLimit).toBeCloseTo(46.66 - 2 * 5.77, 2);
  });

  it("should return failure when klines fetch fails", async () => {
    mockGetKlines.mockResolvedValue({
      erro: true,
      message: "API error",
    });

    const result = await calculateBollLimits({
      symbol: "BTCBRL",
      interval: "1m",
      period: 3,
      width: 2,
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("API error");
  });
});
