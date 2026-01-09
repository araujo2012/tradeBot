import { Types } from "mongoose";
import { intervalList, directionList } from "../order/order.constants";
import { BotDocument } from "models/bot";
import { redis } from "../lib/redis";
import { sleep } from "../lib/sleep";
import { logAndSendToQueue } from "../lib/rabbit";
import { SymbolConfigModel } from "models/symbolConfig";

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

export async function handleRunManagerJobQueue(botId: string) {
  const redisKey = `bot:run:${botId}`;
  const raw = await redis.get(redisKey);
  if (!raw) {
    await redis.setex(
      redisKey,
      60,
      JSON.stringify({
        isRunning: true,
        hasQueue: 0,
      })
    );
    return true;
  }
  const state = JSON.parse(raw);
  if (state.isRunning === true) {
    const nextQueue = (state.hasQueue || 0) + 1;

    let delayMs = 10_000;
    if (state.hasQueue === 1) delayMs = 30_000;
    if (state.hasQueue > 1) delayMs = 60_000;

    await redis.setex(
      redisKey,
      60,
      JSON.stringify({
        isRunning: true,
        hasQueue: nextQueue,
      })
    );

    await sleep(delayMs);

    await logAndSendToQueue("socket", {
      action: "runManagerBot",
      botId,
    });

    return false;
  }
  await redis.setex(
    redisKey,
    60,
    JSON.stringify({
      isRunning: true,
      hasQueue: 0,
    })
  );
  return true;
}

export async function finishRunManagerJobQueue(botId: string) {
  const redisKey = `bot:run:${botId}`;

  const raw = await redis.get(redisKey);
  if (!raw) return;

  const state = JSON.parse(raw);

  await redis.setex(
    redisKey,
    60,
    JSON.stringify({
      isRunning: false,
      hasQueue: state.hasQueue || 0,
    })
  );
}

export async function getMinVarianceBot(minValue: number, money: number) {
  const aboveTax = 0.001 * 4;
  return Math.max(minValue / money, aboveTax);
}
