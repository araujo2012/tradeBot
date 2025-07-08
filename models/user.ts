import { Schema, model } from "mongoose";

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  limit: Number,
  password: String,
  apiKey: String,
  apiSecret: String,
});

export const UserModel = model("User", userSchema);
