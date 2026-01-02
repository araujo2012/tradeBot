import { OrderModel } from "../../models/order";
//import { handleExecutedOrder } from "../transaction/transaction.service";
import { OrderDoc } from "../order/order.type";
import { logAndSendToQueue } from "../lib/rabbit";
import { SessionModel } from "../../models/session";
import { logger } from "app/lib/pino";

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
  if (status === "NEW") return;
  if (status === "CANCELED") {
    const order = await OrderModel.findOne({ binanceId: cancelOrderId });
    if (!order) {
      logger.info({ response }, "Order nao encontrada");
      return;
    }
    order.status = Number(z) > 0 ? "executed" : "closed";
    await order.save();
    return;
  }
  const order = await OrderModel.findOne({ binanceId: clientOrderId });
  if (!order) {
    logger.info({ response }, "Order nao encontrada");
    return;
  }
  if (status === "FILLED" || status === "PARTIALLY_FILLED") {
    order.executedQtd = Number(z);
    order.status = "executed";
    await order.save();
  }
}

export async function handleErrors(response: any) {
  logger.error(response);
}
