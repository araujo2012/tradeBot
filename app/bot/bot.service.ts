import { BotDocument, BotModel } from "../../models/bot";
import { SessionModel } from "../../models/session";
import { OrderModel } from "../../models/order";
import { getRabbitChannel, logAndSendToQueue } from "../lib/rabbit";
import { startBotJob } from "./bot.jobs";
//import { initializeMissingEntryOrders } from "../order/order.service";
import { createOrderFromBot } from "./bot.utils";
import {
  socketOrderCancel,
  socketOrderStatus,
} from "../socket/socket.requests";

async function getBotsByUser(userId: string) {
  return await BotModel.find({ userId });
}

async function getTotalLimitBySession({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}) {
  const bots = await BotModel.find({ userId, sessionId });
  const total = bots.reduce((acc, bot) => acc + (bot.limit ?? 0), 0);
  return total;
}

async function createBot(userId: string, botData: any) {
  return await BotModel.create({ ...botData, userId });
}

async function updateBot(botId: string, userId: string, updateData: any) {
  return await BotModel.findOneAndUpdate({ _id: botId, userId }, updateData, {
    new: true,
  });
}

async function startAdministrator(bot: BotDocument, apiKey: string) {
  try {
    const { symbol, sessionId } = bot;
    const orders = await OrderModel.find({
      botId: bot._id,
      status: { $in: ["active", "executed"] },
    });
    const promises = orders.map((order) =>
      socketOrderStatus({
        apiKey,
        origClientOrderId: order.binanceId,
        symbol,
        sessionId: sessionId.toString(),
      })
    );
    const results = await Promise.all(promises);
    results.forEach(async (result) => {
      const order = orders.find(
        (order) => order.binanceId === result.result.clientOrderId
      );
      if (!order) return;
      const executedQtd = Number(result.result.executedQty);
      if (order.executedQtd !== executedQtd) {
        order.executedQtd = executedQtd;
      } else return;
      if (order.executedQtd > 0) {
        order.status = "executed";
      }
      await order.save();
    });
    startBotJob(bot._id.toString(), apiKey);
  } catch (error) {
    bot.status = "error";
    bot.save();
    console.log("[startAdministrator] - ", error);
  }
}

async function stopBot({ botId, userId }: { botId: string; userId: string }) {
  const bot = await BotModel.findOne({ _id: botId, userId });
  if (!bot) throw new Error("Bot not found");
  bot.status = "inactive";
  await bot.save();
  return bot;
}

async function archiveBot(botId: string, userId: string) {
  const bot = await BotModel.findOne({ _id: botId, userId });
  if (!bot) throw new Error("Bot not found");
  bot.status = "archive";
  await bot.save();
  return bot;
}

export const botService = {
  getBotsByUser,
  createBot,
  updateBot,
  stopBot,
  archiveBot,
  getTotalLimitBySession,
  startAdministrator,
};
