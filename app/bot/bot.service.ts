import { BotModel } from "../../models/bot";
import { SessionModel } from "../../models/session";
import { OrderModel } from "../../models/order";
import { getRabbitChannel } from "../lib/rabbit";
import { redis } from "../lib/redis";
import mongoose from "mongoose";
import { startBotJob } from "./bot.jobs";

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

    const activeOrders = await OrderModel.find({
      botId: botId,
      status: "active",
    });

    // 2. Para cada ordem encontrada, enviar mensagem para a fila do socket do RabbitMQ
    const channel = getRabbitChannel();
    let cancelSended = 0;
    for (const order of activeOrders) {
      if (order.binanceId !== "") {
        const message = {
          action: "cancelOrder",
          payload: {
            apiKey: session.apiKey,
            origClientOrderId: order.binanceId,
            symbol: order.symbol,
            userId: session.userId,
          },
        };
        channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        cancelSended += 1;
      }
    }
    startBotJob(botId);
    bot.status = cancelSended > 0 ? "pending" : "active";
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
