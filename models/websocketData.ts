import { Schema, model } from "mongoose";

const websocketData = new Schema(
  {
    sessionId: String,
    type: String,
    payload: {},
  },
  { timestamps: true }
);

export const WebsocketDataModel = model("WebsocketData", websocketData);
