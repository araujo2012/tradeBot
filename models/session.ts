import { Schema, model } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listenKey: { type: String },
    apiKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "reconnecting"],
      default: "inactive",
    },
    name: { type: String },
    limit: { type: Number },
  },
  { timestamps: true }
);

export const SessionModel = model("Session", sessionSchema);
