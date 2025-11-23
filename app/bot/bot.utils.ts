import { Types } from "mongoose";
import { intervalList, directionList } from "../order/order.constants";
import { BotDocument } from "models/bot";

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
