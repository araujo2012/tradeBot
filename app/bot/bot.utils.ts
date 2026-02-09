import { Types } from "mongoose";
import { intervalList, directionList } from "../order/order.constants";
import { BotDocument } from "../../models/bot";
import { redis } from "../lib/redis";

export function createOrderFromBot(bot: BotDocument) {
  return {
    userId: bot.userId as Types.ObjectId,
    botId: bot._id as Types.ObjectId,
    sessionId: bot.sessionId as Types.ObjectId,
    symbol: bot.symbol,
    interval: intervalList[0],
    direction: directionList[0],
    price: 0,
    quantity: 0,
    value: 0,
    entryQtd: 0,
    maxEntry: 0,
    binanceId: "",
    clientId: "",
    executedQtd: 0,
    status: "pending",
    lastExecutedTime: undefined,
    updateTime: undefined,
  };
}

function normalizeBotId(botId: string | Types.ObjectId): string {
  if (typeof botId === "string") return botId;
  if (botId instanceof Types.ObjectId) return botId.toString();
  return String(botId);
}

export async function handleRunManagerJobQueue(
  botId: string
): Promise<boolean> {
  const normalizedBotId = normalizeBotId(botId);
  const lockKey = `bot:inflight:${normalizedBotId}`;
  const acquired = await redis.set(lockKey, "1", "NX");
  if (acquired === null) {
    return false;
  }
  return true;
}

export async function incrementManagerInFlight(botId: string) {
  const normalizedBotId = normalizeBotId(botId);
  const lockKey = `bot:inflight:${normalizedBotId}`;
  const count = await redis.incr(lockKey);
  console.log(botId, count);
}

export async function decrementManagerInFlight(botId: string) {
  const normalizedBotId = normalizeBotId(botId);
  const lockKey = `bot:inflight:${normalizedBotId}`;
  const remaining = await redis.decr(lockKey);
  console.log(botId, remaining);
  if (remaining <= 0) {
    await redis.del(lockKey);
  }
}

export async function getMinVarianceBot(minValue: number, money: number) {
  const aboveTax = 0.001 * 4;
  return Math.max(minValue / money, aboveTax);
}
