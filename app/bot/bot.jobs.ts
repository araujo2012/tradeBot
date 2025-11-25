import { SessionModel } from "../../models/session";
import { BotDocument, BotModel } from "../../models/bot";
import { setOrders } from "../order/order.service";
import { OrderModel } from "../../models/order";
import { OrderDoc } from "../order/order.type";
import { handleExecutedOrder } from "../executedOrder/executedOrder.service";
import { normalizeValue } from "../order/order.utils";
import { SymbolConfigModel } from "../../models/symbolConfig";
import { logAndSendToQueue } from "../lib/rabbit";

export async function runBotJob(botId: string, apiKey: string) {
  const bot = await BotModel.findById(botId);
  switch (bot?.mode) {
    case "administrator":
      await runAdministratorJob(bot, apiKey);
      break;
    default:
      break;
  }
  console.log(bot?.name);
}

async function runAdministratorJob(bot: BotDocument, apiKey: string) {
  const orders = await OrderModel.find({ botId: bot._id });
  const executedOrders = orders.filter(
    (order) => order.executedQtd === order.quantity
  );
  await Promise.all(
    executedOrders.map((order) => {
      if (order.direction === "buy") {
        bot.crypto += order.executedQtd;
      } else {
        bot.crypto -= order.executedQtd;
      }
      order.status = "closed";
      order.save();
    })
  );
  await bot.save();
  const activeOrders = orders.filter(
    (order) => order.executedQtd !== order.quantity
  );
  const crypto =
    bot.crypto +
    activeOrders.reduce((acc, order) => {
      return order.direction === "buy"
        ? acc + order.executedQtd
        : acc - order.executedQtd;
    }, 0);
  const variance = bot.target * 0.013;
  const symbolConfig = await SymbolConfigModel.findOne({
    symbol: bot.symbol,
  }).lean();
  const [buyOrders, sellOrders] = generateNewOrdersAdministrator(
    crypto,
    bot.target,
    variance,
    symbolConfig
  );
  let buyPosition = 0;
  let sellPosition = 0;
  let buyOperation = "";
  let sellOperation = "";
  for (let i = 3; i >= 0; i -= 1) {
    const buyOrder = buyOrders[i - 3];
    const buyActiveOrder = activeOrders.find(
      (order) => order.position === buyOrder.position
    );
    if (!buyActiveOrder) {
      buyOperation = "create";
    } else {
      if (buyActiveOrder.executedQtd > 0) {
        buyOperation = "cancel";
      }
      if (
        buyActiveOrder.quantity !== buyOrder.quantity ||
        buyActiveOrder.price !== buyOrder.price
      ) {
        buyOperation = "replace";
      }
    }
    if (buyOperation !== "") {
      buyPosition = i;
      break;
    }
  }
  for (let i = 3; i >= 0; i -= 1) {
    const sellOrder = sellOrders[i - 3];
    const sellActiveOrder = activeOrders.find(
      (order) => order.position === sellOrder.position
    );
    if (!sellActiveOrder) {
      sellOperation = "create";
    } else {
      if (sellActiveOrder.executedQtd > 0) {
        sellOperation = "cancel";
      }
      if (
        sellActiveOrder.quantity !== sellOrder.quantity ||
        sellActiveOrder.price !== sellOrder.price
      ) {
        sellOperation = "replace";
      }
    }
    if (sellOperation !== "") {
      sellPosition = i;
      break;
    }
  }
  switch (buyOperation) {
    case "create":
      const order = buyOrders.find((order) => order.position === buyPosition);
      if (!order || buyPosition === 0) break;
      const message = {
        action: "createOrder",
        payload: {
          botId: bot._id.toString,
          mode: "administrator",
          direction: "buy",
          price: order.price,
          quantity: order.quantity,
          symbol: bot.symbol,
          position: buyPosition,
        },
        apiKey,
      };
      logAndSendToQueue("socket", message);
      break;
    default:
      break;
  }
  switch (sellOperation) {
    case "create":
      const order = sellOrders.find((order) => order.position === sellPosition);
      if (!order || sellPosition === 0) break;
      const message = {
        action: "createOrder",
        payload: {
          botId: bot._id.toString,
          mode: "administrator",
          direction: "sell",
          price: order.price,
          quantity: order.quantity,
          symbol: bot.symbol,
          position: sellPosition,
        },
        apiKey,
      };
      logAndSendToQueue("socket", message);
      break;
    default:
      break;
  }
}

function generateNewOrdersAdministrator(
  crypto: number,
  target: number,
  variance: number,
  symbolConfig: any
) {
  const buyOrders: {
    direction: "buy";
    quantity: number;
    price: number;
    position: number;
  }[] = [];
  const sellOrders: {
    direction: "sell";
    quantity: number;
    price: number;
    position: number;
  }[] = [];
  let simulatedCrypto = crypto;
  let count = 0;
  while (count < 3) {
    const sellPrice = (target + variance) / simulatedCrypto;
    const sellQuantity = normalizeValue({
      value: variance / sellPrice,
      decimal: symbolConfig.qtdDecimal,
      isRoundUp: false,
    });
    sellOrders.push({
      direction: "sell",
      quantity: sellQuantity,
      price: normalizeValue({
        value: sellPrice,
        decimal: symbolConfig.priceDecimal,
        isRoundUp: true,
      }),
      position: count + 1,
    });
    simulatedCrypto -= sellQuantity;
    count += 1;
  }
  simulatedCrypto = crypto;
  count = 0;
  while (count < 3) {
    const buyPrice = (target - variance) / simulatedCrypto;
    const buyQuantity = normalizeValue({
      value: variance / buyPrice,
      decimal: symbolConfig.qtdDecimal,
      isRoundUp: false,
    });
    buyOrders.push({
      direction: "buy",
      quantity: buyQuantity,
      price: normalizeValue({
        value: buyPrice,
        decimal: symbolConfig.priceDecimal,
        isRoundUp: false,
      }),
      position: count + 1,
    });
    simulatedCrypto += buyQuantity;
    count += 1;
  }
  return [buyOrders.reverse(), sellOrders.reverse()];
}

const botIntervals: Record<string, NodeJS.Timeout> = {};

function handleExecutedOrders(
  orders: OrderDoc[],
  apiKey: string,
  bot: BotDocument
) {
  const promises = [];
  for (const order of orders) {
    promises.push(
      handleExecutedOrder({
        order,
        apiKey,
        bot,
      })
    );
  }
  return Promise.all(promises);
}

export function startBotJob(botId: string, apiKey: string) {
  if (botIntervals[botId]) return; // já está rodando
  botIntervals[botId] = setInterval(() => runBotJob(botId, apiKey), 60 * 1000);
  console.log(`Bot ${botId} iniciado.`);
}

export function stopBotJob(botId: string) {
  if (botIntervals[botId]) {
    clearInterval(botIntervals[botId]);
    delete botIntervals[botId];
  }
}
