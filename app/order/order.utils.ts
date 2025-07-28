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
  date: Date;
  period: number;
  interval: number;
}): number {
  if (!date) {
    return 1;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (period * interval * 60000));
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
