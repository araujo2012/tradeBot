import { Schema, model, Document } from "mongoose";

export interface UserDocument extends Document {
  username: string;
  password: string;
  apiKey?: string;
  apiSecret?: string;
  limit?: number;
  name?: string;
  email?: string;
  phone?: string;
}

const userSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    apiKey: { type: String },
    apiSecret: { type: String },
    limit: { type: Number },
    name: { type: String },
    email: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
);

export const UserModel = model<UserDocument>("User", userSchema);
