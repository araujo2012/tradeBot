import { ExecutedOrder, ExecutedOrderModel } from "../../models/executedOrder";
import { OrderDoc } from "../order/order.type";
import {
  socketOrderCancel,
  socketOrderStatus,
} from "../socket/socket.requests";
import { OrderResult, OrderStatus } from "../binance/binance.interface";
import { BotDoc, BotDocument, BotModel } from "../../models/bot";
import {
  createTransactions,
  updateTransactionsByExecutedQtd,
} from "../transaction/transaction.service";
import { getSpeed } from "../order/order.utils";

export async function handleExecutedOrder({
  order,
  apiKey,
  bot,
}: {
  order: OrderDoc;
  apiKey: string;
  bot: BotDocument;
}) {
  try {
    const { result } = await socketOrderStatus({
      apiKey,
      origClientOrderId: order.binanceId,
      symbol: order.symbol,
      sessionId: order.sessionId,
    });
    if (result.status === OrderStatus.FILLED) {
      await handleTransactions({ result, order, bot });
    } else if (result.status === OrderStatus.PARTIALLY_FILLED) {
      const { result } = await socketOrderCancel({
        apiKey,
        origClientOrderId: order.binanceId,
        symbol: order.symbol,
        sessionId: order.sessionId,
      });
      if (result.status !== OrderStatus.CANCELED) {
        throw new Error("Order partially filled not canceled");
      }
      await handleTransactions({ result, order, bot });
    } else if (result.status === OrderStatus.CANCELED) {
      await handleTransactions({ result, order, bot });
    }
  } catch (error) {
    console.error(error);
  }
}

async function syncOrder({
  result,
  order,
}: {
  result: OrderResult;
  order: OrderDoc;
}) {
  return ExecutedOrderModel.create({
    userId: order.userId,
    botId: order.botId,
    sessionId: order.sessionId,
    symbol: result.symbol,
    price: Number(result.cummulativeQuoteQty) / Number(result.executedQty),
    quantity: Number(result.executedQty),
    entryQtd: order.entryQtd,
    value: Number(result.cummulativeQuoteQty),
    interval: order.interval,
    direction: order.direction,
    binanceId: result.clientOrderId,
    clientId: result.clientOrderId,
    executedQtd: Number(result.executedQty),
    status: "NEW",
    executedTime: new Date(result.updateTime),
  });
}

async function syncBot({
  order,
  botId,
  executedQtd,
  entryQtd,
}: {
  order: ExecutedOrder;
  botId: string;
  executedQtd: number;
  entryQtd: number;
}) {
  const bot = await BotModel.findById(botId);
  if (!bot) throw new Error(`Bot ${botId} not found`);
  if (order.direction === "buy") {
    const entryMultiplier = getSpeed({
      interval: undefined,
      speed: 1 + bot.buySpeed,
      isNormal: true,
      isEntry: true,
    });
    const multiplier = getSpeed({
      interval: undefined,
      speed: 1 + bot.buySpeed,
      isNormal: true,
      isEntry: false,
    });
    bot.crypto += entryMultiplier * entryQtd + executedQtd * multiplier;
    bot.brl -= entryQtd * order.price;
  }
  if (order.direction === "sell") {
    const entryMultiplier = getSpeed({
      interval: undefined,
      speed: 1 + bot.sellSpeed,
      isNormal: true,
      isEntry: true,
    });
    const multiplier = getSpeed({
      interval: undefined,
      speed: 1 + bot.sellSpeed,
      isNormal: true,
      isEntry: false,
    });
    bot.brl +=
      (entryMultiplier * entryQtd + multiplier * executedQtd) * order.price;
    bot.crypto -= entryQtd;
  }
  await bot.save();
}

async function handleTransactions({
  result,
  order,
  bot,
}: {
  result: OrderResult;
  order: OrderDoc;
  bot: BotDocument;
}) {
  const executedOrder = await syncOrder({ result, order });
  await executedOrder.save();
  order.status = "closed";
  await order.save();

  const executedOrderData: ExecutedOrder = {
    userId: executedOrder.userId.toString(),
    botId: executedOrder.botId.toString(),
    sessionId: executedOrder.sessionId.toString(),
    symbol: executedOrder.symbol,
    price: executedOrder.price,
    quantity: executedOrder.quantity,
    entryQtd: executedOrder.entryQtd,
    value: executedOrder.value,
    interval: executedOrder.interval,
    direction: executedOrder.direction,
    binanceId: executedOrder.binanceId,
    clientId: executedOrder.clientId,
    executedQtd: executedOrder.executedQtd,
    status: executedOrder.status,
    executedTime: executedOrder.executedTime || new Date(),
  };

  const entryQtd =
    executedOrder.entryQtd > executedOrder.executedQtd
      ? executedOrder.executedQtd
      : executedOrder.entryQtd;
  const executedQtd = executedOrder.executedQtd - entryQtd;

  await createTransactions({
    executedOrder: executedOrderData,
    bot,
    entryQtd,
    executedQtd,
  });

  await syncBot({
    order: executedOrderData,
    botId: order.botId.toString(),
    entryQtd,
    executedQtd,
  });
  executedOrder.executedQtd -= entryQtd;
  if (executedOrder.executedQtd > 0) {
    const params = {
      userId: executedOrder.userId.toString(),
      botId: executedOrder.botId.toString(),
      sessionId: executedOrder.sessionId.toString(),
      interval: executedOrder.interval,
      direction: (executedOrder.direction === "buy" ? "sell" : "buy") as
        | "sell"
        | "buy",
    };
    await updateTransactionsByExecutedQtd({
      params,
      executedQtd: executedOrder.executedQtd,
    });
    executedOrder.executedQtd = 0;
  }
  executedOrder.status = "DONE";
  await executedOrder.save();
}
