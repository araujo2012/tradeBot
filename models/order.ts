import { directionList, intervalList } from "../app/order/order.constants";
import { Schema, model } from "mongoose";

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    symbol: { type: String, required: true },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    interval: {
      type: String,
      enum: intervalList,
      required: true,
    },
    direction: {
      type: String,
      enum: directionList,
      required: true,
    },
    entryQtd: { type: Number, default: 0 },
    maxEntry: { type: Number, default: 0 },
    binanceId: { type: String, default: "" },
    clientId: { type: String, default: "" },
    executedQtd: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "executed", "closed", "pending"],
      required: true,
      default: "closed",
    },
    lastExecutedTime: { type: Date },
    updateTime: { type: Date },
  },
  { timestamps: true }
);

export const OrderModel = model("Order", orderSchema);
