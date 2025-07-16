import { IntervalType } from "./order.type";

export const intervalList = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
] as IntervalType[];
export const intervalData = {
  "1m": { entry: 0 },
  "5m": { entry: 1 },
  "15m": { entry: 2 },
  "1h": { entry: 3 },
  "4h": { entry: 4 },
  "1d": { entry: 5 },
};
export const directionList = ["buy", "sell"];
