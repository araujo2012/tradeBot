import { BotDocument, BotModel } from "../../models/bot";
import { SessionModel } from "../../models/session";
import { OrderModel } from "../../models/order";
import { getRabbitChannel, logAndSendToQueue } from "../lib/rabbit";
import { startBotJob } from "./bot.jobs";
import { initializeMissingEntryOrders } from "../order/order.service";

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

async function startBot(botId: string) {
  const bot = await BotModel.findById(botId);
  if (!bot) throw new Error("Bot not found");
  switch (bot.mode) {
    case "administrator":
      await startAdministrator(bot);
      break;
    default:
      break;
  }
}

async function startAdministrator(bot: BotDocument) {
  try {
    const orders = await OrderModel.find({
      botId: bot._id,
      status: { $in: ["active", "executed"] },
    });
    console.log(orders);
  } catch (error) {
    console.log("[startAdministrator] - ", error);
  }
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
  getTotalLimitBySession,
};
