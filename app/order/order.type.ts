import type { BotType, modeType } from "../bot/bot.type";
import type { Document } from "mongoose";

export interface OrderEntry {
  botId: string;
  mode: modeType;
  direction: "buy" | "sell";
  price: number;
  quantity: number;
  symbol: string;
  position?: 1 | 2 | 3;
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
  mode: modeType;
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
