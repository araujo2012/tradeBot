import type mongoose from "mongoose";

export type modeType = "administrator" | "manager";
export const modeEnum = ["administrator", "manager"];

export interface BotType {
  name: string;
  sessionId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  symbol: "BTCBRL" | "ETHBRL" | "USDTBRL" | "BNBBRL" | "SOLBRL" | "XRPBRL";
  status: "active" | "inactive" | "archive" | "pending" | "error";
  limit: number;
  mode: modeType;
  brl: number;
  crypto: number;
  target: number;
  lastExecutionTime?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
