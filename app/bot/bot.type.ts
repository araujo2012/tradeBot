import type mongoose from "mongoose";

export interface BotType {
  _id: string | mongoose.Types.ObjectId;
  name: string;
  sessionId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  symbol: "BTCBRL" | "ETHBRL" | "USDTBRL" | "BNBBRL" | "SOLBRL" | "XRPBRL";
  status: "active" | "inactive" | "archive" | "pending" | "error";
  buySpeed: number;
  sellSpeed: number;
  buyProtection: number;
  sellProtection: number;
  period: number;
  width: number;
  limit: number;
  brl: number;
  crypto: number;
  cryptoTarget: number;
  profit: number;
  createdAt?: Date;
  updatedAt?: Date;
}
