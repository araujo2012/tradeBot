import { OrderModel } from "../../models/order";

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
  const { C: binanceId, z } = response;
  const executedQtd = Number(z);
  const order = await OrderModel.findOne({ binanceId });
  if (!order) {
    console.log(`[Binance - cancelOrder] Ordem ${binanceId} nao encontrada.`);
    return;
  }
  if (executedQtd > 0) {
    order.executedQtd = executedQtd;
    order.status = "executed";
    if (executedQtd > 0) {
      order.lastExecutedTime = new Date();
    }
    await order.save();
    console.log(
      `[Binance] Ordem cancelada com executedQtd: ${executedQtd}, status: ${order.status}`
    );
    return;
  }

  return response;
}

export async function handleErrors(response: any) {
  console.log(response);
}
