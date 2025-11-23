import { BotDocument, BotModel } from "../../models/bot";
import { SessionModel } from "../../models/session";
import { OrderModel } from "../../models/order";
import { getRabbitChannel, logAndSendToQueue } from "../lib/rabbit";
import { startBotJob } from "./bot.jobs";
import { initializeMissingEntryOrders } from "../order/order.service";
import { createOrderFromBot } from "./bot.utils";

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

async function startBot(botId: string, apiKey: string) {
  const bot = await BotModel.findById(botId);
  if (!bot) throw new Error("Bot not found");
  switch (bot.mode) {
    case "administrator":
      await startAdministrator(bot, apiKey);
      break;
    default:
      break;
  }
}

async function startAdministrator(bot: BotDocument, apiKey: string) {
  try {
    const orders = await OrderModel.find({
      botId: bot._id,
      status: { $in: ["active", "executed"] },
    });
    const wasExecuted = orders.find((order) => order.status === "executed");
    const orderBody = createOrderFromBot(bot);
    if (wasExecuted) {
      //desativa o bot para teste caso seja executado
      bot.status = "inactive";
      bot.save();
    } else {
      const variance = bot.target * 0.013;
      const buyPrice = (bot.target - variance) / bot.crypto;
      const sellPrice = (bot.target + variance) / bot.crypto;
      const buyOrder = orders.find((order) => order.direction === "buy");
      const sellOrder = orders.find((order) => order.direction === "sell");
      if (!buyOrder) {
        const payload = {
          ...orderBody,
          direction: "buy",
          price: buyPrice,
          quantity: variance / buyPrice,
          mode: "administrator",
        };
        const message = {
          action: "createOrder",
          payload,
          apiKey,
        };
        logAndSendToQueue("socket", message);
      }
      if (!sellOrder) {
        const payload = {
          ...orderBody,
          direction: "sell",
          price: sellPrice,
          quantity: variance / sellPrice,
          mode: "administrator",
        };
        const message = {
          action: "createOrder",
          payload,
          apiKey,
        };
        logAndSendToQueue("socket", message);
      }
      console.log({ buyPrice, sellPrice });
    }
  } catch (error) {
    bot.status = "error";
    bot.save();
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
