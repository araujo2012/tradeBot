import { redis } from "../lib/redis";
import { intervalData } from "./order.constants";
import { IntervalType } from "./order.type";
import { SymbolConfigModel } from "../../models/symbolConfig";

export const getSpeed = ({
  isNormal,
  isEntry,
  speed,
  interval,
}: {
  isNormal: boolean;
  isEntry: boolean;
  speed: number;
  interval: IntervalType | undefined;
}) => {
  const intervalValue = interval
    ? intervalData[interval].entry
    : isEntry
    ? 6
    : -1;
  //entry
  if (!isNormal) {
    const total =
      1 + speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed))));
    return Math.pow(speed, intervalValue) / total;
  }
  const total =
    1 +
    speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed)))));
  //executed entry or normal
  if (isEntry) {
    return Math.pow(speed, 6 - intervalValue) / total;
  }
  //normal executed
  return Math.pow(speed, 5 - intervalValue) / total;
};

export const getSymbolConfig = async (symbol: string) => {
  const symbolConfigKey = `symbolConfig-${symbol}`;
  let symbolConfig = null;
  const cachedConfig = await redis.get(symbolConfigKey);
  if (cachedConfig) {
    symbolConfig = JSON.parse(cachedConfig);
  } else {
    symbolConfig = await SymbolConfigModel.findOne({ symbol: symbol });
    if (symbolConfig) {
      await redis.set(
        symbolConfigKey,
        JSON.stringify(symbolConfig),
        "EX",
        60 * 60 * 24
      ); // 24h
    }
  }
  return symbolConfig;
};

export function minutesSince({
  date,
  period,
  interval,
}: {
  date: Date | undefined;
  period: number;
  interval: number;
}): number {
  if (!date) {
    return 1;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs / (period * interval * 60000);
}

export const normalizeValue = ({
  value,
  decimal,
  isRoundUp,
}: {
  value: number;
  decimal: number;
  isRoundUp: boolean;
}) => {
  value = isRoundUp
    ? Math.ceil(value * Math.pow(10, decimal))
    : Math.floor(value * Math.pow(10, decimal));
  return value / Math.pow(10, decimal);
};

export function getLastExecutedTimeFromInterval(
  interval: string,
  period: number
): Date {
  const now = Date.now();
  const mapping: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  };

  const offset = period * (mapping[interval] ?? 0);
  return new Date(now - offset);
}

export function calculateWeightedPriceStats(
  transactions: Array<{ price: number; quantity: number }>
) {
  if (transactions.length === 0) {
    return { weightedAverage: 0, weightedStdDev: 0, totalQuantity: 0 };
  }
  const totalWeight = transactions.reduce(
    (sum, transaction) => sum + transaction.quantity,
    0
  );
  if (totalWeight === 0) {
    return { weightedAverage: 0, weightedStdDev: 0, totalQuantity: 0 };
  }
  const weightedSum = transactions.reduce(
    (sum, transaction) => sum + transaction.price * transaction.quantity,
    0
  );
  const weightedAverage = weightedSum / totalWeight;
  const weightedVariance =
    transactions.reduce((sum, transaction) => {
      const deviation = transaction.price - weightedAverage;
      return sum + deviation * deviation * transaction.quantity;
    }, 0) / totalWeight;

  const weightedStdDev = Math.sqrt(weightedVariance);

  return {
    weightedAverage: Number(weightedAverage.toFixed(6)),
    weightedStdDev: Number(weightedStdDev.toFixed(6)),
    totalQuantity: totalWeight,
  };
}

export function probabilityOfZ({
  mean,
  stdDev,
  z,
  direction,
}: {
  mean: number;
  stdDev: number;
  z: number;
  direction: "buy" | "sell";
}): number {
  if (stdDev <= 0) {
    return 0.5;
  }
  const standardizedZ = (z - mean) / stdDev;
  const cdf = 0.5 * (1 + erf(standardizedZ / Math.SQRT2));
  return direction === "buy" ? 1 - cdf : cdf;
}

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}
