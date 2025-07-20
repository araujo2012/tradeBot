import { redis } from "../lib/redis";
import { intervalData } from "./order.constants";
import { IntervalType } from "./order.type";
import { SymbolConfigModel } from "../../models/symbolConfig";

export const getSpeed = ({
  isExecuted,
  isEntry,
  speed,
  interval,
}: {
  isExecuted: boolean;
  isEntry: boolean;
  speed: number;
  interval: IntervalType | undefined;
}) => {
  const intervalValue = interval
    ? intervalData[interval].entry
    : isEntry
    ? 6
    : -1;
  if (!isExecuted) {
    const total =
      1 + speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed))));
    return Math.pow(speed, intervalValue) / total;
  }
  const total =
    1 +
    speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed)))));
  if (isEntry) {
    return Math.pow(speed, 6 - intervalValue) / total;
  }
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
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (period * interval * 60000));
}
