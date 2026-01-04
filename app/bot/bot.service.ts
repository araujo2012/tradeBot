import { BotDocument, BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { startBotJob } from "./bot.jobs";
import { socketOrderStatus } from "../socket/socket.requests";

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

export const botService = {
  startAdministrator,
};
