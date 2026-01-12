import { Types } from "mongoose";
import { intervalList, directionList } from "../order/order.constants";
import { BotDocument } from "../../models/bot";
import { redis } from "../lib/redis";
import { sleep } from "../lib/sleep";
import { logAndSendToQueue } from "../lib/rabbit";

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
  const delayKey = `bot:delay:${normalizedBotId}`;
  const raw = await redis.get(lockKey);
  if (raw !== null && Number(raw) > 0) {
    const queue = await redis.incr(delayKey);
    await redis.expire(delayKey, 60);
    let delayMs = 10_000;
    if (queue === 2) delayMs = 30_000;
    if (queue > 2) delayMs = 60_000;
    await sleep(delayMs);
    logAndSendToQueue("socket", {
      action: "runManagerBot",
      botId: normalizedBotId,
    });
    return false;
  }
  await redis.set(lockKey, "1", "EX", 60);
  await redis.del(delayKey);
  return true;
}

export async function incrementManagerInFlight(botId: string) {
  const normalizedBotId = normalizeBotId(botId);
  const lockKey = `bot:inflight:${normalizedBotId}`;
  const count = await redis.incr(lockKey);
  console.log(botId, count);
  await redis.expire(lockKey, 60);
}

export async function decrementManagerInFlight(botId: string) {
  const normalizedBotId = normalizeBotId(botId);
  const lockKey = `bot:inflight:${normalizedBotId}`;
  const exists = await redis.exists(lockKey);
  if (!exists) return;
  const remaining = await redis.decr(lockKey);
  console.log(botId, remaining);
  if (remaining <= 0) {
    await redis.del(lockKey);
  }
}

export async function finishRunManagerJobQueue(
  botId: string | Types.ObjectId,
  publishedMessages: number
) {
  const normalizedBotId = normalizeBotId(botId);
  const lockKey = `bot:inflight:${normalizedBotId}`;
  if (publishedMessages === 0) {
    await redis.del(lockKey);
  }
}

export async function getMinVarianceBot(minValue: number, money: number) {
  const aboveTax = 0.001 * 4;
  return Math.max(minValue / money, aboveTax);
}
