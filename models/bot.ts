import { BotType, modeEnum } from "../app/bot/bot.type";
import mongoose, { Schema, HydratedDocument } from "mongoose";

export type BotDocument = HydratedDocument<BotType>;

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
      enum: modeEnum,
      required: true,
    },
    target: {
      type: Number,
      required: true,
      default: 0,
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
    lastExecutionTime: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const BotModel = mongoose.model<BotDocument>("Bot", botSchema);
