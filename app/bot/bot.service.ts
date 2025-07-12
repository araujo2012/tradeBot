import { BotModel } from "../../models/bot";
import { SessionModel } from "../../models/session";
import mongoose from "mongoose";

export class BotService {
  async getBotsByUser(userId: string) {
    return await BotModel.find({ userId });
  }

  async createBot(userId: string, botData: any) {
    return await BotModel.create({ ...botData, userId });
  }

  async updateBot(botId: string, userId: string, updateData: any) {
    return await BotModel.findOneAndUpdate({ _id: botId, userId }, updateData, {
      new: true,
    });
  }

  async startBot(botId: string, userId: string) {
    const bot = await BotModel.findOne({ _id: botId, userId });
    if (!bot) throw new Error("Bot not found");
    const session = await SessionModel.findOne({
      _id: bot.sessionId,
      userId: bot.userId,
      status: "active",
    });
    if (!session) throw new Error("Session for this bot is not active");
    bot.status = "active";
    await bot.save();
    return bot;
  }

  async stopBot(botId: string, userId: string) {
    const bot = await BotModel.findOne({ _id: botId, userId });
    if (!bot) throw new Error("Bot not found");
    bot.status = "inactive";
    await bot.save();
    return bot;
  }

  async archiveBot(botId: string, userId: string) {
    const bot = await BotModel.findOne({ _id: botId, userId });
    if (!bot) throw new Error("Bot not found");
    bot.status = "archive";
    await bot.save();
    return bot;
  }
}
