import { BotType } from "app/bot/bot.type";
import mongoose, { Document, Schema } from "mongoose";

export interface BotDocument extends BotType {}

export interface BotDoc {
  name: string;
  sessionId: string;
  userId: string;
  symbol: string;
  status: string;
  mode: string;
  limit: number;
  brl: number;
  crypto: number;
  updatedTime: Date;
}

const botSchema = new Schema<BotDocument>(
  {
    name: { type: String, required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    symbol: {
      type: String,
      enum: ["BTCBRL", "ETHBRL", "USDTBRL", "BNBBRL", "SOLBRL", "XRPBRL"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archive", "pending", "error"],
      default: "inactive",
    },
    limit: {
      type: Number,
      required: true,
      default: 0,
    },
    mode: {
      type: String,
      enum: ["administrator"],
      required: true,
    },
    brl: {
      type: Number,
      required: true,
      default: 0,
    },
    crypto: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

export const BotModel = mongoose.model<BotDocument>("Bot", botSchema);
