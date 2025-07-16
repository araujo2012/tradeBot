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
      enum: ["in", "out"],
      required: true,
    },
    interval: {
      type: String,
      enum: ["1m", "5m", "15m", "1h", "4h", "1d"],
      required: true,
    },
    direction: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
    },
    binanceId: { type: String, required: true },
    executed: { type: Boolean },
  },
  { timestamps: true }
);

export const OrderModel = model("Order", orderSchema);
