import { Schema, model } from "mongoose";

const transactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    symbol: String,
    value: Number,
    price: Number,
    quantity: Number,
  },
  { timestamps: true }
);

export const TransactionModel = model("Transaction", transactionSchema);
