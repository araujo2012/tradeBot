import { agenda } from "../lib/agenda";
import { SessionModel } from "../../models/session";
import { BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { logAndSendToQueue } from "../lib/rabbit";
import { sendToActivateBotQueue } from "app/lib/bullMq";

export const CHECK_BUY_SELL = "checkBuyAndSellOrder";
export const RUN_MANAGER_BOTS = "runManagerBotsBatch";

async function processBotOrders({
  bot,
  session,
}: {
  bot: {
    _id: any;
    sessionId: any;
    symbol: string;
  };
  session: {
    apiKey: string;
  };
}) {
  const orders = await OrderModel.find({
    botId: bot._id,
    status: "active",
    direction: { $in: ["buy", "sell"] },
  })
    .select("direction binanceId")
    .lean();
  const buyOrders = orders.filter((o) => o.direction === "buy");
  const sellOrders = orders.filter((o) => o.direction === "sell");
  let cancelled = false;
  if (buyOrders.length > 1) {
    for (const order of buyOrders.slice(1)) {
      logAndSendToQueue("socket", {
        action: "cancelOrder",
        payload: {
          apiKey: session.apiKey,
          origClientOrderId: order.binanceId,
          symbol: bot.symbol,
          sessionId: bot.sessionId.toString(),
        },
      });
      cancelled = true;
    }
  }
  if (sellOrders.length > 1) {
    for (const order of sellOrders.slice(1)) {
      logAndSendToQueue("socket", {
        action: "cancelOrder",
        payload: {
          apiKey: session.apiKey,
          origClientOrderId: order.binanceId,
          symbol: bot.symbol,
          sessionId: bot.sessionId.toString(),
        },
      });
      cancelled = true;
    }
  }
  if (cancelled) return;
  if (buyOrders.length < 1 || sellOrders.length < 1) {
    sendToActivateBotQueue({
      action: "runManagerBot",
      botId: bot._id.toString(),
    });
  }
}

agenda.define(
  CHECK_BUY_SELL,
  {
    concurrency: 1,
    lockLifetime: 50_000,
  },
  async () => {
    const sessions = await SessionModel.find({ status: "active" })
      .select("_id apiKey")
      .lean();
    if (!sessions.length) return;
    const sessionMap = new Map(sessions.map((s) => [s._id.toString(), s]));
    const bots = await BotModel.find({
      sessionId: { $in: sessions.map((s) => s._id) },
      status: "active",
      mode: "manager",
    })
      .select("_id sessionId symbol")
      .lean();
    for (const bot of bots) {
      const session = sessionMap.get(bot.sessionId.toString());
      if (!session) continue;
      await processBotOrders({ bot, session });
    }
  }
);

agenda.define(
  RUN_MANAGER_BOTS,
  {
    concurrency: 1,
    lockLifetime: 2 * 60 * 1000,
  },
  async () => {
    const sessions = await SessionModel.find({ status: "active" })
      .select("_id")
      .lean();

    if (!sessions.length) return;

    const bots = await BotModel.find({
      sessionId: { $in: sessions.map((s) => s._id) },
      status: "active",
      mode: "manager",
    })
      .select("_id")
      .lean();

    for (const bot of bots) {
      if (Math.random() <= 0.1) {
        sendToActivateBotQueue({
          action: "runManagerBot",
          botId: bot._id.toString(),
        });
      }
    }
  }
);
