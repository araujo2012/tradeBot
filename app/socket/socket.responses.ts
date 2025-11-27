import { OrderModel } from "../../models/order";
import { handleExecutedOrder } from "../transaction/transaction.service";
import { OrderDoc } from "../order/order.type";
import { logAndSendToQueue } from "../lib/rabbit";
import { SessionModel } from "../../models/session";

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
    if (status === "FILLED") {
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

export async function handleReplaceOrderResponse(response: any) {
  const { newOrderResult, cancelResponse, newOrderResponse, cancelResult } =
    response;
  const order: OrderDoc | null = await OrderModel.findOne({
    binanceId: cancelResponse.origClientOrderId,
  });
  if (!order) {
    return;
  }
  if (cancelResult === "FAILURE" || Number(cancelResponse.executedQty) > 0) {
    order.status = "executed";
    await order.save();
  } else {
    if (newOrderResult === "FAILURE") {
      order.status = "closed";
      await order.save();
      return;
    }
    const { price, origQty, clientOrderId, executedQty, cummulativeQuoteQty } =
      newOrderResponse;
    order.binanceId = clientOrderId;
    const isExecuted = Number(executedQty) > 0;
    order.status = isExecuted ? "executed" : "active";
    const executedPrice = isExecuted
      ? Number(cummulativeQuoteQty) / Number(executedQty)
      : Number(price);
    order.price = executedPrice;
    order.quantity = Number(origQty);
    order.value = executedPrice * Number(origQty);
    await order.save();
  }
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
    }
    if (executedQtd - order.executedQtd > 0) {
      order.lastExecutedTime = new Date();
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
    if (!order) {
      console.log("[ORDER NOT FOUND] - ", { order });
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

export async function handleExecutionReport(response: any) {
  const { event } = response;
  const { X, c, z } = event;
  if (X === "NEW") return;
  const order = await OrderModel.findOne({ binanceId: c });
  if (!order) {
    console.log(response, " nao foi possivel encontrar");
    return;
  }
  switch (X) {
    case "FILLED":
      order.executedQtd = Number(z);
      order.status = "executed";
      await order.save();
      break;
    case "PARTIALLY_FILLED":
      order.executedQtd = Number(z);
      order.status = "executed";
      await order.save();
      break;
    default:
      break;
  }
}

export async function handleErrors(response: any) {
  console.log(response);
}
