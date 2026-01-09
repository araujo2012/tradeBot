import { Schema, model, HydratedDocument } from "mongoose";
export interface SymbolConfigType {
  symbol: String;
  priceDecimal: number;
  qtdDecimal: number;
  minValue: number;
}
export type SymbolConfigDocument = HydratedDocument<SymbolConfigType>;

const symbolConfigSchema = new Schema<SymbolConfigDocument>({
  symbol: { type: String, required: true },
  priceDecimal: { type: Number, required: true },
  qtdDecimal: { type: Number, required: true },
  minValue: { type: Number, required: true },
});

export const SymbolConfigModel = model("SymbolConfig", symbolConfigSchema);
