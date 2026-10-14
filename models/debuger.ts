import { Schema, model } from "mongoose";

const debuger = new Schema(
  {
    sessionId: String,
    method: String,
    requestId: String,
    params: {},
    status: Number,
    error: {},
  },
  { timestamps: true }
);

export const DebugerModel = model("Debuger", debuger, "debuger");
