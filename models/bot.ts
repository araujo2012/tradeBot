import mongoose, { Document, Schema } from "mongoose";

export interface BotDocument extends Document {
  name: string;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  symbol: "BTCBRL" | "ETHBRL" | "USDTBRL" | "BNBBRL" | "SOLBRL" | "XRPBRL";
  status: "active" | "inactive" | "archive";
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
      enum: ["active", "inactive", "archive"],
      default: "inactive",
    },
    buyProtection: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 35,
    },
    sellProtection: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 35,
    },
    period: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 1,
    },
    width: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 5,
    },
    buySpeed: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.618,
    },
    sellSpeed: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.618,
    },
    limit: {
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
    cryptoTarget: {
      type: Number,
      required: true,
      default: 0,
    },
    profit: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export const BotModel = mongoose.model<BotDocument>("Bot", botSchema);
