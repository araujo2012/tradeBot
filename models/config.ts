import { Schema, model } from "mongoose";

const configSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  symbol: String,
  cashBank: Number,
  cryptoBank: Number,
  cryptoGoal: Number,
});

export const ConfigModel = model("Config", configSchema);
