import { intervalList } from "../app/order/order.constants";
import { Schema, model } from "mongoose";

const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    symbol: String,
    value: Number,
    price: Number,
    quantity: Number,
    executedQtd: Number,
    direction: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      required: true,
      default: "open",
    },
    interval: {
      type: String,
      enum: intervalList,
      required: true,
    },
    fromInterval: {
      type: String,
      enum: intervalList,
      required: true,
    },
    type: {
      type: String,
      enum: ["entry", "normal"],
      required: true,
      default: "normal",
    },
    binanceId: { type: String, required: true },
  },
  { timestamps: true }
);

export const TransactionModel = model("Transaction", transactionSchema);
