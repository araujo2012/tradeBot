import { OrderModel } from "../../models/order";
import { handleExecutedOrder } from "../transaction/transaction.service";
import { OrderDoc } from "../order/order.type";

export async function handlePlaceOrderResponse(response: any) {
  const { id, result } = response;
  const { executedQty, clientOrderId, status } = result || {};
  const order = await OrderModel.findOne({ clientId: id });

  if (order) {
    order.binanceId = clientOrderId;
    if (status === "NEW") {
      order.status = "active";
    }
    if (status === "FILLED" || Number(executedQty) > 0) {
      order.executedQtd = Number(executedQty);
      order.status = "executed";
      if (Number(executedQty) > 0) {
        order.lastExecutedTime = new Date();
      }
    }
    await order.save();
    console.log(
      `[Binance] Ordem atualizada com binanceId: ${clientOrderId}, status: ${order.status}`
    );
  } else {
    console.warn(
      `[Binance] Nenhuma ordem correspondente encontrada para atualizar binanceId: ${clientOrderId}`
    );
  }
  return response;
}

//adicionar logica de ordens executadas
export async function handleCancelOrderResponse(response: any) {
  try {
    const { C: binanceId, z } = response;
    const executedQtd = Number(z);
    const order: OrderDoc | null = await OrderModel.findOne({ binanceId });
    if (!order) {
      return;
    }
    if (order.executedQtd > 0) {
      if (order.status !== "executed") {
        order.status = "executed";
        await order.save();
      }
      order.executedQtd = executedQtd;
      order.lastExecutedTime = new Date();
    }
    order.status = "closed";
    await order.save();
    if (executedQtd - order.executedQtd > 0) {
      await handleExecutedOrder({
        order,
        executedQtd: executedQtd - order.executedQtd,
      });
    }
    return response;
  } catch (error) {
    console.log("handleCancelOrderResponse - ", error);
  }
}

export async function handleErrors(response: any) {
  console.log(response);
}
