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
  const randomDelayMs = Math.floor(Math.random() * 5000);
  if (randomDelayMs > 0) {
    await sleep(randomDelayMs);
  }
  const normalizedBotId = normalizeBotId(botId);
  console.log(normalizedBotId);
  console.log("ISO:", new Date().toISOString());
  const lockKey = `bot:lock:${normalizedBotId}`;
  const delayKey = `bot:delay:${normalizedBotId}`;
  const lock = await redis.set(lockKey, "1", "EX", 60, "NX");
  if (lock === "OK") {
    await redis.del(delayKey);
    return true;
  }
  console.log(lockKey);
  const queue = await redis.incr(delayKey);
  await redis.expire(delayKey, 120);
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

export async function finishRunManagerJobQueue(botId: string | Types.ObjectId) {
  const normalizedBotId = normalizeBotId(botId);
  const lockKey = `bot:lock:${normalizedBotId}`;
  await redis.del(lockKey);
}

export async function getMinVarianceBot(minValue: number, money: number) {
  const aboveTax = 0.001 * 4;
  return Math.max(minValue / money, aboveTax);
}
