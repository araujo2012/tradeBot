import { BotDocument, BotModel } from "../../models/bot";
import {
  INSUFFICIENT_BALANCE_MESSAGE,
  NEW_ORDER_REJECTED_CODE,
} from "../binance/binance.constants";
import { AccountBalance, BinanceError } from "../binance/binance.interface";
import { OrderType } from "../../models/order";
import { OrderEntry } from "../order/order.type";
import { socketAccountStatus } from "../socket/socket.requests";
import { lockInsufficientBalance } from "../bot/bot.utils";
import { logger } from "../lib/pino";

// Ativo guardado no campo `brl` do bot: todos os símbolos são cotados em BRL.
const BALANCE_ASSET = "BRL";

type OrderCost = Pick<OrderType, "direction" | "price" | "quantity">;

// BRL que a Binance bloqueia ao aceitar a ordem; vendas bloqueiam cripto, não BRL.
export function getOrderBrlCost(order: OrderCost) {
  return order.direction === "buy" ? order.price * order.quantity : 0;
}

export function isInsufficientBalanceError(response: {
  error?: BinanceError;
}) {
  const { code, msg = "" } = response.error || {};
  return (
    code === NEW_ORDER_REJECTED_CODE &&
    msg.toLowerCase().includes(INSUFFICIENT_BALANCE_MESSAGE)
  );
}

// Com `omitZeroBalances`, a Binance não lista ativos zerados.
function getFreeBalance(balances: AccountBalance[], asset: string) {
  const balance = balances.find((item) => item.asset === asset);
  return Number(balance?.free ?? 0);
}

// Busca o saldo livre na Binance e grava no `brl` de todos os bots da sessão,
// já que eles operam na mesma conta.
async function refreshAccountBalance({
  sessionId,
  apiKey,
}: {
  sessionId: string;
  apiKey: string;
}) {
  const response = await socketAccountStatus({ sessionId, apiKey });
  if (response.status !== 200 || !response.result) {
    throw new Error(
      `Binance account.status error: ${response.error?.msg || response.status}`
    );
  }
  const free = getFreeBalance(response.result.balances, BALANCE_ASSET);
  await BotModel.updateMany({ sessionId }, { brl: free });
  logger.info({ sessionId, free }, "Account balance refreshed");
  return free;
}

// Atualiza o saldo pela Binance. Se ainda não cobrir a ordem, trava o bot até uma
// ordem dele ser executada ou o lock expirar.
export async function refreshBalanceForOrder({
  order,
  botId,
  sessionId,
  apiKey,
}: {
  order: OrderCost;
  botId: string;
  sessionId: string;
  apiKey: string;
}) {
  const free = await refreshAccountBalance({ sessionId, apiKey });
  const isEnough = getOrderBrlCost(order) <= free;
  if (!isEnough) await lockInsufficientBalance(botId);
  return isEnough;
}

// Confere o saldo local; se não cobrir a ordem, atualiza pela Binance e confere de novo.
// Se a consulta falhar, a ordem não é enviada.
export async function hasBalanceForOrder({
  order,
  bot,
  apiKey,
}: {
  order: OrderEntry;
  bot: BotDocument;
  apiKey: string;
}) {
  if (getOrderBrlCost(order) <= bot.brl) return true;
  try {
    return await refreshBalanceForOrder({
      order,
      botId: bot._id.toString(),
      sessionId: bot.sessionId.toString(),
      apiKey,
    });
  } catch (err) {
    logger.error({ err, botId: bot._id }, "Failed to refresh account balance");
    return false;
  }
}
