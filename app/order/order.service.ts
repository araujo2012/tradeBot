import { calculateBollLimits } from "../limits/limits.service";
import { OrderModel } from "../../models/order";
import { intervalList, intervalData, tax, orderRange } from "./order.constants";
import type { BotType } from "../bot/bot.type";
import type { OrderEntry, IntervalType, ActiveOrder } from "./order.type";
import {
  getLastExecutedTimeFromInterval,
  getSpeed,
  getSymbolConfig,
  minutesSince,
  normalizeValue,
  calculateWeightedPriceStats,
  probabilityOfZ,
} from "./order.utils";
import { logAndSendToQueue } from "../lib/rabbit";
import { getCurrentPrice } from "../binance/binance.service";
import { TransactionModel } from "../../models/transaction";

interface TransactionStats {
  weightedAverage: number;
  weightedStdDev: number;
  totalQuantity: number;
}

interface EntryStats {
  quantity: number;
  value: number;
  buyPrice: number;
  sellPrice: number;
}

function handleOutOfRangeOrder({
  transactions,
  minProfit,
  priceDecimal,
  qtdDecimal,
  entryPrice,
  entryValue,
  isSell,
}: {
  transactions: any[];
  minProfit: number;
  priceDecimal: number;
  qtdDecimal: number;
  entryPrice: number;
  entryValue: number;
  isSell: boolean;
}) {
  let totalQuantity = 0;
  let result = 0;
  let price = 0;
  let limitPrice = isSell ? 0 : Infinity;
  let entryQtd = 0;
  for (const tx of transactions) {
    const profitPrice = normalizeValue({
      value: tx.price * (isSell ? minProfit : 1 / minProfit),
      decimal: priceDecimal,
      isRoundUp: true,
    });
    const canExecuteEntry = isSell
      ? profitPrice > entryPrice
      : profitPrice < entryPrice;
    if (canExecuteEntry) {
      const haveToExit = isSell
        ? entryPrice > limitPrice
        : entryPrice < limitPrice;
      if (result > 10 && haveToExit) {
        break;
      }
      price = entryPrice;
      totalQuantity += isSell ? entryValue : entryValue / price;
      entryQtd = isSell ? entryValue : entryValue / price;
      result =
        price *
        normalizeValue({
          value: totalQuantity,
          decimal: qtdDecimal,
          isRoundUp: false,
        });
      if (result > 10 && (limitPrice === 0 || limitPrice === Infinity)) {
        limitPrice = price * (isSell ? orderRange : 1 / orderRange);
      }
    }
    const haveToExit = isSell
      ? profitPrice > limitPrice
      : profitPrice < limitPrice;
    if (result > 10 && haveToExit) {
      break;
    }
    totalQuantity += tx.quantity - tx.executedQtd;
    price = profitPrice;
    result =
      price *
      normalizeValue({
        value: totalQuantity,
        decimal: qtdDecimal,
        isRoundUp: false,
      });
    if (result > 10 && (limitPrice === 0 || limitPrice === Infinity)) {
      limitPrice = price * (isSell ? orderRange : 1 / orderRange);
    }
  }
  if (result < 10) {
    return null;
  } else {
    totalQuantity = normalizeValue({
      value: totalQuantity,
      decimal: qtdDecimal,
      isRoundUp: false,
    });
    return { totalQuantity, price, entryQtd };
  }
}

export async function getActiveOrdersByUser(userId: string) {
  return OrderModel.find({ userId, status: "active" }).select(
    "symbol quantity price"
  );
}
