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
  limit: number;
  brl: number;
  crypto: number;
  cryptoTarget: number;
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
    limit: {
      type: Number,
      required: true,
      default: 0,
    },
    brl: {
      type: Number,
      required: true,
      default: 0,
    },
    crypto: {
      type: Number,
      required: true,
      default: 0,
    },
    cryptoTarget: {
      type: Number,
      required: true,
      default: 0,
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
