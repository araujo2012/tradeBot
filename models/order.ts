import { directionList, intervalList } from "../app/order/order.constants";
import { Schema, model } from "mongoose";

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    symbol: { type: String, required: true },
    price: { type: Number },
    quantity: { type: Number },
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
    binanceId: { type: String, required: true },
    executed: { type: Boolean },
    status: {
      type: String,
      enum: ["active", "executed", "closed"],
      required: true,
      default: "closed",
    },
  },
  { timestamps: true }
);

export const OrderModel = model("Order", orderSchema);
