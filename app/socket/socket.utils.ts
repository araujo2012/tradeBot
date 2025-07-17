import axios from "axios";
import { redis } from "../lib/redis";

export async function getOrSetOffset(): Promise<number> {
  const redisKey = "binance:offset";
  const cached = await redis.get(redisKey);
  if (cached) return parseInt(cached, 10);

  const { data } = await axios.get("https://api.binance.com/api/v3/time");
  const offset = Date.now() - data.serverTime;

  await redis.set(redisKey, offset.toString(), "EX", 3600); // TTL = 1h
  return offset;
}
