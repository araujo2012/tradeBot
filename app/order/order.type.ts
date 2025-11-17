import type { BotType } from "../bot/bot.type";
import type { Document } from "mongoose";

export interface OrderEntry {
  botId: string;
  sessionId: string;
  userId: string;
  direction: "buy" | "sell";
  interval: IntervalType;
  price: number;
  quantity: number;
  entryQtd: number;
  maxEntry: number;
  symbol: string;
  value: number;
  period: number;
  apiKey: string;
  timeMultiplier?: number;
  type?: "entry" | "normal";
}

export interface CalculateEntryOrderParams {
  bot: BotType;
  interval: IntervalType;
}

export type IntervalType = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type OrderDoc = Document & {
  _id: string;
  userId: string;
  botId: string;
  sessionId: string;
  symbol: string;
  price: number;
  quantity: number;
  entryQtd: number;
  value: number;
  type: "entry" | "normal";
  interval: string;
  direction: "buy" | "sell";
  binanceId: string;
  executed?: boolean;
  executedQtd: number;
  status: "active" | "executed" | "closed" | "pending";
  createdAt?: Date;
  updatedAt?: Date;
  lastExecutedTime?: Date;
  updateTime?: Date;
};

export interface ActiveOrder {
  _id: any;
  interval: IntervalType;
  direction: string;
  price: number;
  quantity: number;
  lastExecutedTime: Date;
  status: string;
}
