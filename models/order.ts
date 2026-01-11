import { modeEnum, modeType } from "../app/bot/bot.type";
import { directionList } from "../app/order/order.constants";
import { Schema, model, HydratedDocument, Types } from "mongoose";

export interface OrderType {
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  sessionId: Types.ObjectId;
  mode: modeType;
  symbol: string;
  price: number;
  quantity: number;
  value: number;
  direction: string;
  binanceId: string;
  clientId: string;
  executedQtd: number;
  status: "active" | "executed" | "partialExecuted" | "closed" | "pending";
  position?: number;
}

export type OrderDocument = HydratedDocument<OrderType>;

const orderSchema = new Schema<OrderType>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    mode: {
      type: String,
      enum: modeEnum,
      required: true,
    },
    symbol: { type: String, required: true },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
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
      enum: ["active", "executed", "partialExecuted", "closed", "pending"],
      required: true,
      default: "closed",
    },
    position: { type: Number },
  },
  { timestamps: true }
);

export const OrderModel = model("Order", orderSchema);
