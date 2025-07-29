import { OrderModel } from "../../models/order";
import { handleExecutedOrder } from "../transaction/transaction.service";
import { OrderDoc } from "../order/order.type";
import { logAndSendToQueue } from "../lib/rabbit";
import { SessionModel } from "../../models/session";

export async function handlePlaceOrderResponse(response: any) {
  const { result } = response;
  const { clientOrderId, status } = result || {};
  const order = await OrderModel.findOne({ binanceId: clientOrderId });

  if (order) {
    order.binanceId = clientOrderId;
    if (status === "NEW") {
      order.status = "active";
      await order.save();
      console.log(`[Binance] Ordem criada com binanceId: ${order}`);
    }
    if (status === "FILLED") {
      order.status = "executed";
      await order.save();
      console.log(`[Binance] Ordem criada com binanceId: ${order}`);
    }
    if (status === "CANCELED") {
      order.status = "closed";
      await order.save();
      console.log(`[Binance] Ordem criada com binanceId: ${order}`);
    }
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
    const { c: binanceId, z, Z } = response;
    const executedQtd = Number(z);
    const executedPrice = Number(Z) / executedQtd;
    const order: OrderDoc | null = await OrderModel.findOne({ binanceId });
    if (!order) {
      return;
    }
    if (order.executedQtd > 0) {
      order.executedQtd = executedQtd;
      order.lastExecutedTime = new Date();
    }
    if (executedQtd - order.executedQtd > 0) {
      order.status = "executed";
      await order.save();
      await handleExecutedOrder({
        order,
        executedQtd: executedQtd - order.executedQtd,
        executedPrice,
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
    const { c: binanceId, z, Z } = response;
    const executedQtd = Number(z);
    const executedPrice = Number(Z) / executedQtd;
    const order: OrderDoc | null = await OrderModel.findOne({ binanceId });
    if (!order || executedQtd === 0) {
      return;
    }
    order.binanceId = binanceId;
    order.status = "executed";
    order.executedQtd = executedQtd;
    order.lastExecutedTime = new Date();
    await order.save();
    await handleExecutedOrder({
      order,
      executedQtd,
      executedPrice,
    });
    return response;
  } catch (error) {
    console.log("handleCancelOrderResponse - ", error);
  }
}

export async function handlePartiallyFilledOrderResponse(response: any) {
  try {
    const { c: binanceId } = response;
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
