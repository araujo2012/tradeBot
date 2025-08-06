import { directionList, intervalList } from "../app/order/order.constants";
import { Schema, model } from "mongoose";

const executedOrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    symbol: { type: String, required: true },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ["entry", "normal"],
      required: true,
      default: "normal",
    },
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

export const ExecutedOrderModel = model("ExecutedOrder", executedOrderSchema);
