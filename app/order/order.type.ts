import type { BotType } from "../bot/bot.type";

export interface OrderEntry {
  botId: string;
  direction: "buy" | "sell";
  interval: string;
  type: "entry";
  price: number;
  quantity: number;
}

export interface CalculateEntryOrderParams {
  bot: BotType;
  interval: IntervalType;
}

export type IntervalType = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
