import { redis } from "../lib/redis";
import { intervalData } from "./order.constants";
import { IntervalType } from "./order.type";
import { SymbolConfigModel } from "../../models/symbolConfig";

export const getSpeed = ({
  speed,
  interval,
}: {
  speed: number;
  interval: IntervalType;
}) => {
  const total =
    1 + speed * (1 + speed * (1 + speed * (1 + speed * (1 + speed))));
  return Math.pow(speed, intervalData[interval].entry) / total;
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
