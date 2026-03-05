import type { modeType } from "../bot/bot.type";

export interface OrderEntry {
  botId: string;
  mode: modeType;
  direction: "buy" | "sell";
  price: number;
  quantity: number;
  symbol: string;
  position?: 1 | 2 | 3;
}
