import { Schema, model } from "mongoose";

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    symbol: String,
    value: Number,
    price: Number,
    quantity: Number,
    type: String,
    interval: String,
    executed: Boolean,
    status: String,
  },
  { timestamps: true }
);

export const OrderModel = model("Order", orderSchema);
