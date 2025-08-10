import { directionList, intervalList } from "../app/order/order.constants";
import { Schema, model } from "mongoose";

export interface ExecutedOrder {
  userId: string;
  botId: string;
  sessionId: string;
  symbol: string;
  price: number;
  quantity: number;
  entryQtd: number;
  value: number;
  interval: string;
  direction: string;
  binanceId: string;
  clientId: string;
  executedQtd: number;
  status: string;
  executedTime: Date;
}

const executedOrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    symbol: { type: String, required: true },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    entryQtd: { type: Number, default: 0 },
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
    binanceId: { type: String, default: "" },
    clientId: { type: String, default: "" },
    executedQtd: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["NEW", "CREATED", "DONE"],
      required: true,
      default: "NEW",
    },
    executedTime: { type: Date },
  },
  { timestamps: true }
);

export const ExecutedOrderModel = model("ExecutedOrder", executedOrderSchema);
