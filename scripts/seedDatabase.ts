import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { UserModel } from "../models/user";
import { ConfigModel } from "../models/config";

async function seedDatabase() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined in .env file");
  }
  const userId = new Types.ObjectId();
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    const userExists = await UserModel.findOne({ name: "araujo2012" });
    if (!userExists) {
      const user = await UserModel.create({
        _id: userId,
        name: "araujo2012",
        limit: 1000,
        password: "admin123",
        apiKey: "your-api-key",
        apiSecret: "your-api-secret",
      });
      console.log("🧑 User created:", user);
    } else {
      console.log("🧑 User already exists");
    }
    const configExists = await ConfigModel.findOne({
      user: userId,
      symbol: "BTCBRL",
    });
    if (!configExists) {
      const config = await ConfigModel.create({
        user: userId,
        symbol: "BTCBRL",
        cashBank: 1000,
        cryptoBank: 0,
        cryptoGoal: 0,
      });
      console.log("⚙️ Config created:", config);
    } else {
      console.log("⚙️ Config already exists");
    }
    console.log("🚪 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error populating database:", error);
  }
  mongoose.disconnect();
}

seedDatabase();
