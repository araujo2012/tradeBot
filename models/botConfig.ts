import mongoose, { Schema, Document } from "mongoose";

export interface IBotConfig extends Document {
  _id: string;
  userId: string;
  buyProtection: number;
  sellProtection: number;
  period: number;
  width: number;
  name: string;
  buySpeed: number;
  sellSpeed: number;
  createdAt: Date;
  updatedAt: Date;
}

const botConfigSchema = new Schema<IBotConfig>(
  {
    userId: {
      type: String,
      index: true,
    },
    buyProtection: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 35,
    },
    sellProtection: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 35,
    },
    period: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 1,
    },
    width: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 5,
    },
    buySpeed: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.618,
    },
    sellSpeed: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.618,
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

export const BotConfigModel = mongoose.model<IBotConfig>(
  "BotConfig",
  botConfigSchema
);
