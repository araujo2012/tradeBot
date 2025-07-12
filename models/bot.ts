import mongoose, { Document, Schema } from "mongoose";

export interface BotDocument extends Document {
  name: string;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  symbol: "BTCBRL" | "ETHBRL" | "USDTBRL" | "BNBBRL" | "SOLBRL" | "XRPBRL";
  status: "active" | "inactive" | "archive";
}

const botSchema = new Schema<BotDocument>(
  {
    name: { type: String, required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    symbol: {
      type: String,
      enum: ["BTCBRL", "ETHBRL", "USDTBRL", "BNBBRL", "SOLBRL", "XRPBRL"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archive"],
      default: "inactive",
    },
  },
  { timestamps: true }
);

export const BotModel = mongoose.model<BotDocument>("Bot", botSchema);
