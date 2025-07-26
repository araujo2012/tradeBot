import { BotModel } from "../../models/bot";
import { SessionModel } from "../../models/session";
import { OrderModel } from "../../models/order";
import { getRabbitChannel } from "../lib/rabbit";
import { startBotJob } from "./bot.jobs";

async function getBotsByUser(userId: string) {
  return await BotModel.find({ userId });
}

async function createBot(userId: string, botData: any) {
  return await BotModel.create({ ...botData, userId });
}

async function updateBot(botId: string, userId: string, updateData: any) {
  return await BotModel.findOneAndUpdate({ _id: botId, userId }, updateData, {
    new: true,
  });
}

async function startBot(botId: string) {
  const bot = await BotModel.findById(botId);
  if (!bot) throw new Error("Bot not found");
  const session = await SessionModel.findOne({
    _id: bot.sessionId,
    userId: bot.userId,
    status: "active",
  });
  if (!session) throw new Error("Session for this bot is not active");
  const activeOrders = await OrderModel.find({
    botId,
    status: { $in: ["active", "executed", "pending"] },
  });
  const channel = getRabbitChannel();
  const syncOrders = activeOrders
    .filter((order) => order.binanceId !== "")
    .map(async (order) => {
      order.status = "pending";
      await order.save();

      const message = {
        action: "syncOrder",
        payload: {
          apiKey: session.apiKey,
          origClientOrderId: order.binanceId,
          symbol: order.symbol,
          sessionId: session._id.toString(),
        },
      };

      channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });

      return 1;
    });

  const results = await Promise.all(syncOrders);
  const cancelSended = results.reduce((acc, val) => acc + val, 0);
  bot.status = cancelSended > 0 ? "pending" : "active";
  await bot.save();
  startBotJob(botId, session.apiKey);
  return bot;
}

async function stopBot(botId: string, userId: string) {
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
  startBot,
  stopBot,
  archiveBot,
};
