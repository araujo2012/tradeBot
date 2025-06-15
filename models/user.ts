import { Schema, model } from "mongoose";

const userSchema = new Schema({
  name: String,
  limit: Number,
  password: String,
  apiKey: String,
  apiSecret: String,
});

export const UserModel = model("User", userSchema);
