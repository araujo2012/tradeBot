import mongoose, { Schema, Document } from "mongoose";

export interface IBotConfig extends Document {
  userId: string;
  buyProtection: number;
  sellProtection: number;
  periodo: number;
  largura: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const botConfigSchema = new Schema<IBotConfig>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    buyProtection: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    sellProtection: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    periodo: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 0,
    },
    largura: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 0,
    },
    name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const BotConfig = mongoose.model<IBotConfig>(
  "BotConfig",
  botConfigSchema
);
