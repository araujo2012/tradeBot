import { OrderModel } from "../../models/order";
import { handleExecutedOrder } from "../transaction/transaction.service";
import { OrderDoc } from "../order/order.type";
import { logAndSendToQueue } from "app/lib/rabbit";
import { SessionModel } from "models/session";

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
      order.executedQtd = executedQtd;
      order.lastExecutedTime = new Date();
    }
    if (executedQtd - order.executedQtd > 0) {
      order.status = "pending";
      await order.save();
      await handleExecutedOrder({
        order,
        executedQtd: executedQtd - order.executedQtd,
      });
    } else {
      order.status = "closed";
      await order.save();
    }
    return response;
  } catch (error) {
    console.log("handleCancelOrderResponse - ", error);
  }
}

export async function handleFilledOrderResponse(response: any) {
  try {
    const { C: binanceId, z } = response;
    const executedQtd = Number(z);
    const order: OrderDoc | null = await OrderModel.findOne({ binanceId });
    if (!order || executedQtd === 0) {
      return;
    }
    order.status = "pending";
    order.executedQtd = executedQtd;
    order.lastExecutedTime = new Date();
    await order.save();
    await handleExecutedOrder({
      order,
      executedQtd,
    });
    return response;
  } catch (error) {
    console.log("handleCancelOrderResponse - ", error);
  }
}

export async function handlePartiallyFilledOrderResponse(response: any) {
  try {
    const { C: binanceId, z } = response;
    const order: OrderDoc | null = await OrderModel.findOne({ binanceId });
    const session = await SessionModel.findById(order?.sessionId).lean();
    if (!session || !order) {
      console.log("Could not find session or order", response);
      return;
    }
    const message = {
      action: "cancelOrder",
      payload: {
        apiKey: session.apiKey,
        origClientOrderId: order.binanceId,
        symbol: order.symbol,
        sessionId: session._id.toString(),
      },
    };
    logAndSendToQueue("socket", message);
  } catch (error) {
    console.log("handleCancelOrderResponse - ", error);
  }
}

export async function handleErrors(response: any) {
  console.log(response);
}
