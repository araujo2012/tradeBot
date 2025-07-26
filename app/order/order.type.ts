import type { BotType } from "../bot/bot.type";
import type { Document } from "mongoose";

export interface OrderEntry {
  botId: string;
  sessionId: string;
  userId: string;
  direction: "buy" | "sell";
  interval: IntervalType;
  type: "entry";
  price: number;
  quantity: number;
  symbol: string;
  value: number;
  period: number;
  apiKey: string;
}

export interface CalculateEntryOrderParams {
  bot: BotType;
  interval: IntervalType;
}

export type IntervalType = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type OrderDoc = Document & {
  userId: string;
  botId: string;
  sessionId: string;
  symbol: string;
  price: number;
  quantity: number;
  value: number;
  type: "entry" | "normal";
  interval: string;
  direction: "buy" | "sell";
  binanceId: string;
  executed?: boolean;
  executedQtd: number;
  status: "active" | "executed" | "closed";
  createdAt?: Date;
  updatedAt?: Date;
  lastExecutedTime?: Date;
  updateTime?: Date;
};
