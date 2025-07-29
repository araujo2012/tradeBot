import { TransactionModel } from "../../models/transaction";
import { BotModel } from "../../models/bot";
import { intervalList } from "../order/order.constants";
import { OrderDoc } from "../order/order.type";
import { getSpeed } from "../order/order.utils";
import type { Document, Types } from "mongoose";

export interface TransactionDoc extends Document {
  userId: Types.ObjectId;
  botId: Types.ObjectId;
  sessionId: Types.ObjectId;
  symbol: string;
  value: number;
  price: number;
  quantity: number;
  executedQtd: number;
  status: "open" | "closed";
  interval: string;
  fromInterval: string;
  type: "entry" | "normal";
  binanceId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MatchParams {
  userId: string;
  botId: string;
  sessionId: string;
  interval: string;
  direction: "buy" | "sell";
}

interface HandleExecutedOrderParams {
  order: OrderDoc;
  executedQtd: number;
  executedPrice: number;
}

export async function handleExecutedOrder({
  order,
  executedQtd,
  executedPrice,
}: HandleExecutedOrderParams) {
  const bot = await BotModel.findById(order.botId);
  if (!bot) throw new Error(`Bot ${order.botId} not found`);

  const promises = intervalList.map((interval) => {
    const multiplier = getSpeed({
      interval,
      speed: 1 + (order.direction === "buy" ? bot.buySpeed : bot.sellSpeed),
      isNormal: true,
      isEntry: order.type === "entry",
    });
    return TransactionModel.create({
      userId: order.userId,
      botId: order.botId,
      sessionId: order.sessionId,
      symbol: order.symbol,
      interval,
      fromInterval: order.interval,
      type: order.type,
      price: executedPrice,
      binanceId: order.binanceId,
      value: executedQtd * executedPrice * multiplier,
      quantity: executedQtd * multiplier,
      direction: order.direction,
    });
  });
  const transactions = await Promise.allSettled(promises);
  const successTransaction = transactions.find(
    (transaction) => transaction.status === "fulfilled"
  );

  if (successTransaction) {
    order.status = "closed";
    await order.save();
    if (order.direction === "buy") {
      const multiplier = getSpeed({
        interval: undefined,
        speed: 1 + bot.buySpeed,
        isNormal: true,
        isEntry: order.type === "entry",
      });
      bot.crypto += multiplier * executedQtd;
      if (order.type === "entry") {
        bot.brl -= executedQtd * order.price;
      }
    }
    if (order.direction === "sell") {
      const multiplier = getSpeed({
        interval: undefined,
        speed: 1 + bot.sellSpeed,
        isNormal: true,
        isEntry: order.type === "entry",
      });
      bot.brl += multiplier * executedQtd * order.price;
      if (order.type === "entry") {
        bot.crypto -= executedQtd;
      }
    }
    await bot.save();
    if (order.type === "normal") {
      const params = {
        userId: order.userId.toString(),
        botId: order.botId.toString(),
        sessionId: order.sessionId.toString(),
        interval: order.interval,
        direction: (order.direction === "buy" ? "sell" : "buy") as
          | "sell"
          | "buy",
      };
      await updateTransactionsByExecutedQtd({ executedQtd, params });
    }
  } else {
    console.log(
      "[TRANSACTION ERROR] - ",
      transactions.map((transaction: any) => transaction.reason)
    );
  }
}

export async function updateTransactionsByExecutedQtd({
  params,
  executedQtd,
}: {
  params: MatchParams;
  executedQtd: number;
}) {
  const sortOrder = params.direction === "buy" ? 1 : -1;

  const transactions = await TransactionModel.find({
    ...params,
    status: "open",
  })
    .select("quantity executedQtd status")
    .sort({ price: sortOrder });

  const promises: Promise<any>[] = transactions.map((transaction) => {
    if (executedQtd <= 0) {
      return sleep(1);
    }
    const qtd = transaction.quantity - transaction.executedQtd;
    if (executedQtd > qtd) {
      transaction.executedQtd = transaction.quantity;
      transaction.status = "closed";
      executedQtd -= qtd;
      return transaction.save();
    } else {
      transaction.executedQtd += executedQtd;
      executedQtd = 0;
      return transaction.save();
    }
  });

  const result = await Promise.all(promises);

  return result;
}

export async function sleep(ms: number = 1): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
