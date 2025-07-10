import mongoose, { Document, Schema } from "mongoose";

export interface SessionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  listenKey: string;
  apiKey: string;
  apiSecret: string;
  limit: number;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listenKey: { type: String, required: true },
    apiKey: { type: String, required: true },
    apiSecret: { type: String, required: true },
    limit: { type: Number, required: true },
  },
  { timestamps: true }
);

export const SessionModel = mongoose.model<SessionDocument>(
  "Session",
  sessionSchema
);
