import { directionList } from "../app/order/order.constants";
import { Schema, model, HydratedDocument, Types } from "mongoose";
import { OrderType } from "./order";

export type ExecutedOrderDocument = HydratedDocument<OrderType>;

const executedOrderSchema = new Schema<OrderType>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    mode: {
      type: String,
      enum: ["administrator", "manager"],
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
      enum: ["active", "executed", "closed", "pending"],
      required: true,
      default: "closed",
    },
    position: { type: Number },
  },
  { timestamps: true }
);

export const ExecutedOrderModel = model("Order", executedOrderSchema);
