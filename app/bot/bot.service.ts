import { BotDocument, BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { socketOrderStatus } from "../socket/socket.requests";
import { activeStatus } from "../order/order.constants";
import { logAndSendToQueue } from "../lib/rabbit";
import { sendToActivateBotQueue } from "app/lib/bullMq";

export async function startAdministrator(bot: BotDocument, apiKey: string) {
  try {
    const { symbol, sessionId } = bot;
    const orders = await OrderModel.find({
      botId: bot._id,
      status: { $in: activeStatus },
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
  } catch (error) {
    bot.status = "error";
    bot.save();
    console.log("[startAdministrator] - ", error);
  }
}

export async function startManager(bot: BotDocument, apiKey: string) {
  try {
    const { symbol, sessionId } = bot;
    const orders = await OrderModel.find({
      botId: bot._id,
      status: { $in: activeStatus },
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
      if (executedQtd > order.executedQtd) {
        order.executedQtd = executedQtd;
      } else {
        sendToActivateBotQueue({
          action: "runManagerBot",
          botId: bot._id.toString(),
        });
        return;
      }
      if (order.executedQtd > 0) {
        order.status = "executed";
      }
      await order.save();
    });
    sendToActivateBotQueue({
      action: "runManagerBot",
      botId: bot._id.toString(),
    });
  } catch (error) {
    bot.status = "error";
    bot.save();
    console.log("[startAdministrator] - ", error);
  }
}
