import { Types } from "mongoose";
import { redis } from "../lib/redis";

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

// Sem saldo para a compra, o bot fica parado por este tempo ou até uma ordem dele
// ser executada, evitando consultar a Binance a cada rodada.
const INSUFFICIENT_BALANCE_LOCK_SECONDS = 10 * 60;

function insufficientBalanceLockKey(botId: string | Types.ObjectId) {
  return `bot:insufficient-balance:${normalizeBotId(botId)}`;
}

export async function lockInsufficientBalance(botId: string | Types.ObjectId) {
  await redis.set(
    insufficientBalanceLockKey(botId),
    "1",
    "EX",
    INSUFFICIENT_BALANCE_LOCK_SECONDS
  );
}

export async function hasInsufficientBalanceLock(
  botId: string | Types.ObjectId
) {
  return (await redis.exists(insufficientBalanceLockKey(botId))) === 1;
}

export async function releaseInsufficientBalanceLock(
  botId: string | Types.ObjectId
) {
  await redis.del(insufficientBalanceLockKey(botId));
}

export async function getMinVarianceBot(minValue: number, money: number) {
  const aboveTax = 0.001 * 4;
  return Math.max(minValue / money, aboveTax);
}
