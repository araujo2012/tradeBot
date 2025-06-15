import mongoose from "mongoose";

export async function connectToDatabase() {
  try {
    await mongoose.connect("mongodb://root:example@localhost:27017/", {
      dbName: "botTrade",
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}
