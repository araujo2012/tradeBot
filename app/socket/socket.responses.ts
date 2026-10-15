import { sendToActivateBotQueue } from "../lib/bullMq";
import { OrderModel, OrderDocument } from "../../models/order";
import { releaseInsufficientBalanceLock } from "../bot/bot.utils";

const PARTIAL_FILL_GRACE_MS = Number(
  process.env.PARTIAL_FILL_GRACE_MS || 60_000
);

export async function handlePlaceOrderResponse(response: any) {
  const { id, result } = response;
  const { clientOrderId, status } = result || {};
  const order = await OrderModel.findOne({
    $or: [{ clientId: id }, { binanceId: clientOrderId }],
  });

  if (order) {
    order.binanceId = clientOrderId;
    if (status === "NEW" && order.status === "pending") {
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

// Ordem cancelada na Binance: a parte executada é definitiva e o manager pode contabilizá-la.
export async function markOrderCanceled(
  order: OrderDocument,
  executedQty: number
) {
  if (order.status === "closed") return;
  if (executedQty > order.executedQtd) {
    order.executedQtd = executedQty;
  }
  order.status = order.executedQtd > 0 ? "partialExecuted" : "closed";
  await order.save();
}

export async function handleExecutionReport(response: any) {
  const event = response?.event;
  if (!event) return;
  const { X: status, c: clientOrderId, C: cancelOrderId, z } = event;
  const order = await OrderModel.findOne({
    binanceId: status === "CANCELED" ? cancelOrderId : clientOrderId,
  });
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
  order: OrderDocument;
  executed: number;
}) {
  if (status === "NEW") return;
  if (status === "CANCELED") {
    await markOrderCanceled(order, executed);
    sendToActivateBotQueue({
      action: "runManagerBot",
      botId: order.botId.toString(),
    });
    return;
  }
  if (status === "PARTIALLY_FILLED") {
    order.executedQtd = executed;
    order.status = "executed";
    await order.save();
    await releaseInsufficientBalanceLock(order.botId);
    await new Promise((resolve) =>
      setTimeout(resolve, PARTIAL_FILL_GRACE_MS)
    );
    sendToActivateBotQueue({
      action: "runManagerBot",
      botId: order.botId.toString(),
    });
  }
  if (status === "FILLED") {
    order.executedQtd = executed;
    order.status = "executed";
    await order.save();
    await releaseInsufficientBalanceLock(order.botId);
    sendToActivateBotQueue({
      action: "runManagerBot",
      botId: order.botId.toString(),
    });
  }
  return;
}
