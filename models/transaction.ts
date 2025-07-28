import { intervalList } from "../app/order/order.constants";
import { Schema, model } from "mongoose";

const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    symbol: String,
    value: { type: Number, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    executedQtd: { type: Number, default: 0 },
    direction: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
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
    },
    binanceId: { type: String, required: true },
  },
  { timestamps: true }
);

export const TransactionModel = model("Transaction", transactionSchema);
