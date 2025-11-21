import type mongoose from "mongoose";

export interface BotType {
  _id: string | mongoose.Types.ObjectId;
  name: string;
  sessionId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  symbol: "BTCBRL" | "ETHBRL" | "USDTBRL" | "BNBBRL" | "SOLBRL" | "XRPBRL";
  status: "active" | "inactive" | "archive" | "pending" | "error";
  limit: number;
  mode: "administrator";
  brl: number;
  crypto: number;
  createdAt?: Date;
  updatedAt?: Date;
}
