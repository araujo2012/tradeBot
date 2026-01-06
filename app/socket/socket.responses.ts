import { OrderModel } from "../../models/order";
import { BotOrderDocument, BotOrderModel } from "../../models/botOrder";
import { logger } from "../lib/pino";
import { logAndSendToQueue } from "../lib/rabbit";

export async function handlePlaceOrderResponse(response: any) {
  const { id, result } = response;
  const { clientOrderId, status, executedQty, cummulativeQuoteQty } =
    result || {};
  const order = await OrderModel.findOne({
    $or: [{ clientId: id }, { binanceId: clientOrderId }],
  });

  if (order) {
    order.binanceId = clientOrderId;
    if (status === "NEW" && order.status === "pending") {
      order.binanceId = clientOrderId;
      order.status = "active";
      await order.save();
    }
    if (status === "FILLED" || status === "PARTIALLY_FILLED") {
      order.status = "executed";
      await order.save();
    }
  } else {
    console.warn(
      `[Binance] Nenhuma ordem correspondente encontrada para atualizar binanceId: ${clientOrderId}`
    );
  }
  return response;
}

export async function handleExecutionReport(response: any) {
  const event = response?.event;
  if (!event) return;

  const { X: status, c: clientOrderId, C: cancelOrderId, z } = event;
  let order = await BotOrderModel.findOne({
    binanceId: { $in: [clientOrderId, cancelOrderId] },
  });
  if (!order) {
    order = await OrderModel.findOne({
      binanceId: { $in: [clientOrderId, cancelOrderId] },
    });
  }
  if (!order) return;
  const { mode } = order;
  switch (mode) {
    case "manager":
      await handleExecutionReportManager({
        status,
        order,
        executed: Number(z),
      });
      break;
    case "administrator":
      await handleExecutionReportAdministrator({
        status,
        order,
        executed: Number(z),
      });
      break;
    default:
      break;
  }
}

async function handleExecutionReportManager({
  status,
  order,
  executed,
}: {
  status: string;
  order: BotOrderDocument;
  executed: number;
}) {
  if (status === "NEW") return;
  if (status === "CANCELED") {
    order.status = executed > 0 ? "executed" : "closed";
    await order.save();
    return;
  }
  if (status === "PARTIALLY_FILLED") {
    order.executedQtd = executed;
    order.status = "executed";
    await order.save();
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    const message = {
      action: "runManagerBot",
      botId: order.botId,
    };
    logAndSendToQueue("socket", message);
  }
  if (status === "FILLED") {
    order.executedQtd = executed;
    order.status = "executed";
    await order.save();
    const message = {
      action: "runManagerBot",
      botId: order.botId,
    };
    logAndSendToQueue("socket", message);
  }
  return;
}

async function handleExecutionReportAdministrator({
  status,
  order,
  executed,
}: {
  status: string;
  order: BotOrderDocument;
  executed: number;
}) {
  if (status === "NEW") return;
  if (status === "CANCELED") {
    order.status = executed > 0 ? "executed" : "closed";
    await order.save();
    return;
  }
  if (status === "FILLED" || status === "PARTIALLY_FILLED") {
    order.executedQtd = executed;
    order.status = "executed";
    await order.save();
  }
  return;
}

export async function handleErrors(response: any) {
  logger.error(response);
}
