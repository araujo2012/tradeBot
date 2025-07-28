import { Schema, model } from "mongoose";

const rabbitData = new Schema(
  {
    queue: String,
    payload: {},
  },
  { timestamps: true }
);

export const RabbitDataModel = model("RabbitData", rabbitData);
