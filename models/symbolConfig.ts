import { Schema, model } from "mongoose";

const symbolConfigSchema = new Schema({
  symbol: { type: String, required: true },
  priceDecimal: { type: Number, required: true },
  qtdDecimal: { type: Number, required: true },
  minValue: { type: Number, required: true },
});

export const SymbolConfigModel = model("SymbolConfig", symbolConfigSchema);
