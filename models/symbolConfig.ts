import { Schema, model } from "mongoose";

const symbolConfigSchema = new Schema({
  symbol: String,
  priceDecimal: Number,
  qtdDecimal: Number,
});

export const SymbolConfigModel = model("SymbolConfig", symbolConfigSchema);
