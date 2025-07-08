import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const redis = new Redis(process.env.REDIS_URI!);

redis.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});
