import { LimitsService } from "../limits.service";
import { BinanceService } from "../../binance/binance.service";
import { BinanceStats } from "../../binance/binance.stats";
import { KlinesMock } from "../../binance/__tests__/mocks/klines.mock";

jest.mock("../../binance/binance.service");
jest.mock("../../binance/binance.stats");

describe("LimitsService", () => {
  const MockBinanceService = BinanceService as jest.MockedClass<
    typeof BinanceService
  >;
  const MockBinanceStats = BinanceStats as jest.MockedClass<
    typeof BinanceStats
  >;

  const mockGetKlines = jest.fn();
  const mockCalculateKlineValue = jest.fn();
  const mockCalculateAverage = jest.fn();
  const mockCalculateStandardDeviation = jest.fn();

  beforeEach(() => {
    MockBinanceService.prototype.getKlines = mockGetKlines;
    MockBinanceStats.prototype.calculateKlineValue = mockCalculateKlineValue;
    MockBinanceStats.prototype.calculateAverage = mockCalculateAverage;
    MockBinanceStats.prototype.calculateStandardDeviation =
      mockCalculateStandardDeviation;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return upper and lower limits correctly", async () => {
    const limitsService = new LimitsService();

    mockGetKlines.mockResolvedValue({
      erro: false,
      data: KlinesMock.validKlines,
    });

    mockCalculateKlineValue.mockReturnValue(KlinesMock.validKlineResults);
    mockCalculateAverage.mockReturnValue(46.66);
    mockCalculateStandardDeviation.mockReturnValue(5.77);

    const result = await limitsService.calculateBollLimits(
      "BTCBRL",
      "1m",
      3,
      2
    );

    expect(result.success).toBe(true);
    expect(result.upperLimit).toBeCloseTo(46.66 + 2 * 5.77, 2);
    expect(result.lowerLimit).toBeCloseTo(46.66 - 2 * 5.77, 2);
  });

  it("should return failure when klines fetch fails", async () => {
    const limitsService = new LimitsService();

    mockGetKlines.mockResolvedValue({
      erro: true,
      message: "API error",
    });

    const result = await limitsService.calculateBollLimits(
      "BTCBRL",
      "1m",
      3,
      2
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("API error");
  });
});
