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
  "1m": { entry: 0, timeMultiplier: 1, profit: 1 },
  "5m": { entry: 1, timeMultiplier: 5, profit: 3 },
  "15m": { entry: 2, timeMultiplier: 15, profit: 6 },
  "1h": { entry: 3, timeMultiplier: 60, profit: 10 },
  "4h": { entry: 4, timeMultiplier: 240, profit: 15 },
  "1d": { entry: 5, timeMultiplier: 1440, profit: 21 },
};
export const directionList = ["buy", "sell"];
export const tax = 0.002;
