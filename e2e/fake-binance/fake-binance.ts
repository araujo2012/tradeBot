import http, { IncomingMessage, ServerResponse } from "http";
import { AddressInfo } from "net";
import { randomUUID } from "crypto";
import WebSocket, { WebSocketServer } from "ws";

type FakeOrderStatus =
  | "NEW"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED";

export interface FakeOrderInput {
  clientOrderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  executedQty?: number;
  status?: FakeOrderStatus;
}

interface FakeOrder extends FakeOrderInput {
  orderId: number;
  executedQty: number;
  status: FakeOrderStatus;
}

export interface FakeBinanceCommand {
  sequence: number;
  id: string;
  method: string;
  params: Record<string, any>;
}

function asNumber(value: unknown) {
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new Error(`Expected numeric value, received: ${String(value)}`);
  }
  return result;
}

function asString(value: number) {
  return value.toString();
}

function isOpenOrder(order: FakeOrder) {
  return order.status === "NEW" || order.status === "PARTIALLY_FILLED";
}

// Mesmo erro que a Binance real devolve no order.place quando falta saldo.
const INSUFFICIENT_BALANCE_ERROR = {
  code: -2010,
  msg: "Account has insufficient balance for requested action.",
};

export class FakeBinance {
  private readonly httpServer = http.createServer(
    (request, response) => void this.handleHttpRequest(request, response)
  );
  private readonly websocketServer = new WebSocketServer({ noServer: true });
  private readonly clients = new Set<WebSocket>();
  private readonly orders = new Map<string, FakeOrder>();
  private readonly commands: FakeBinanceCommand[] = [];
  private sequence = 0;
  private nextOrderId = 50_000;
  private port = 0;
  private readonly freeBalances = new Map<string, number>();

  async start() {
    this.httpServer.on("upgrade", (request, socket, head) => {
      this.websocketServer.handleUpgrade(request, socket, head, (client) => {
        this.websocketServer.emit("connection", client, request);
      });
    });

    this.websocketServer.on("connection", (client: WebSocket) => {
      this.clients.add(client);
      client.on("close", () => this.clients.delete(client));
      client.on("message", (data) => void this.handleWebSocketMessage(client, data));
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer.once("error", reject);
      this.httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    this.port = (this.httpServer.address() as AddressInfo).port;

    return {
      wsUrl: `ws://127.0.0.1:${this.port}/ws-api/v3`,
      restUrl: `http://127.0.0.1:${this.port}/api/v3`,
    };
  }

  registerOrder(input: FakeOrderInput) {
    const order: FakeOrder = {
      ...input,
      orderId: this.nextOrderId++,
      executedQty: input.executedQty ?? 0,
      status: input.status ?? "NEW",
    };
    this.orders.set(order.clientOrderId, order);
    return order;
  }

  // Saldo livre informado pelo account.status. Com saldo de BRL definido, order.place
  // recusa compras acima dele. O saldo é fixo: ordens aceitas não o bloqueiam.
  setFreeBalance(asset: string, free: number) {
    this.freeBalances.set(asset, free);
  }

  getCommands() {
    return this.commands.map((command) => ({
      ...command,
      params: { ...command.params },
    }));
  }

  getCommandSummary() {
    return this.commands.map(({ sequence, id, method, params }) => ({
      sequence,
      id,
      method,
      clientOrderId:
        params.origClientOrderId ||
        params.cancelOrigClientOrderId ||
        params.symbol ||
        "",
    }));
  }

  emitExecutionReport({
    clientOrderId,
    status,
    executedQty,
  }: {
    clientOrderId: string;
    status: Extract<FakeOrderStatus, "PARTIALLY_FILLED" | "FILLED">;
    executedQty: number;
  }) {
    const order = this.findOrder(clientOrderId);

    order.executedQty = executedQty;
    order.status = status;

    const message = JSON.stringify({
      event: {
        e: "executionReport",
        E: Date.now(),
        s: order.symbol,
        c: order.clientOrderId,
        C: "",
        X: status,
        z: asString(order.executedQty),
        q: asString(order.quantity),
      },
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  // Simula um cancelamento feito fora do bot cujo evento não chegou à aplicação.
  cancelOrderWithoutNotifying(clientOrderId: string) {
    this.findOrder(clientOrderId).status = "CANCELED";
  }

  async close() {
    for (const client of this.clients) client.terminate();
    this.clients.clear();

    await Promise.race([
      new Promise<void>((resolve) => {
        this.websocketServer.close(() => resolve());
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    ]);

    await new Promise<void>((resolve) => {
      if (!this.httpServer.listening) {
        resolve();
        return;
      }
      this.httpServer.close(() => resolve());
    });
  }

  private findOrder(clientOrderId: string) {
    const order = this.orders.get(clientOrderId);
    if (!order) throw new Error(`Fake order not found: ${clientOrderId}`);
    return order;
  }

  private hasBalanceFor(params: Record<string, any>) {
    const freeBrl = this.freeBalances.get("BRL");
    if (freeBrl === undefined || String(params.side) !== "BUY") return true;
    return asNumber(params.price) * asNumber(params.quantity) <= freeBrl;
  }

  private async handleHttpRequest(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/v3/time") {
      this.writeJson(response, 200, { serverTime: Date.now() });
      return;
    }

    if (url.pathname === "/api/v3/klines") {
      this.writeJson(response, 200, this.buildKlines());
      return;
    }

    this.writeJson(response, 404, { code: -404, msg: "Not found" });
  }

  private buildKlines() {
    return Array.from({ length: 40 }, (_, index) => [
      String(index),
      "100",
      "100",
      "100",
      "100",
      "100",
      String(index + 1),
      "100",
      "1",
      "50",
      "50",
      "0",
    ]);
  }

  private async handleWebSocketMessage(
    client: WebSocket,
    data: WebSocket.RawData
  ) {
    const message = JSON.parse(data.toString()) as {
      id: string;
      method: string;
      params?: Record<string, any>;
    };
    const command: FakeBinanceCommand = {
      sequence: ++this.sequence,
      id: message.id,
      method: message.method,
      params: message.params || {},
    };
    this.commands.push(command);

    switch (message.method) {
      case "session.logon":
        this.send(client, message.id, 200, {});
        return;
      case "userDataStream.subscribe":
        this.send(client, message.id, 200, { subscriptionId: randomUUID() });
        return;
      case "order.status":
        this.handleOrderStatus(client, message.id, command.params);
        return;
      case "order.place":
        this.handleOrderPlace(client, message.id, command.params);
        return;
      case "order.cancel":
        this.handleOrderCancel(client, message.id, command.params);
        return;
      case "order.cancelReplace":
        this.handleOrderCancelReplace(client, message.id, command.params);
        return;
      case "account.status":
        this.handleAccountStatus(client, message.id);
        return;
      default:
        this.send(client, message.id, 400, undefined, -1000, "Unknown method");
    }
  }

  private handleOrderStatus(
    client: WebSocket,
    id: string,
    params: Record<string, any>
  ) {
    const order = this.orders.get(String(params.origClientOrderId));
    if (!order) {
      this.send(client, id, 400, undefined, -2013, "Order does not exist");
      return;
    }
    this.send(client, id, 200, this.toOrderResult(order));
  }

  private handleOrderPlace(
    client: WebSocket,
    id: string,
    params: Record<string, any>
  ) {
    if (!this.hasBalanceFor(params)) {
      const { code, msg } = INSUFFICIENT_BALANCE_ERROR;
      this.send(client, id, 400, undefined, code, msg);
      return;
    }
    const order = this.registerOrder({
      clientOrderId: `fake-${this.nextOrderId}`,
      symbol: String(params.symbol),
      side: String(params.side) === "SELL" ? "SELL" : "BUY",
      price: asNumber(params.price),
      quantity: asNumber(params.quantity),
    });
    this.send(client, id, 200, this.toOrderResult(order));
  }

  private handleOrderCancel(
    client: WebSocket,
    id: string,
    params: Record<string, any>
  ) {
    const order = this.orders.get(String(params.origClientOrderId));
    // A Binance só cancela ordens abertas; já canceladas ou executadas retornam -2011.
    if (!order || !isOpenOrder(order)) {
      this.send(client, id, 400, undefined, -2011, "Unknown order sent.");
      return;
    }
    order.status = "CANCELED";
    this.send(client, id, 200, {
      ...this.toOrderResult(order),
      origClientOrderId: order.clientOrderId,
    });
  }

  private handleOrderCancelReplace(
    client: WebSocket,
    id: string,
    params: Record<string, any>
  ) {
    const original = this.orders.get(String(params.cancelOrigClientOrderId));
    if (!original) {
      this.send(client, id, 400, undefined, -2011, "Unknown order");
      return;
    }

    original.status = "CANCELED";
    const replacement = this.registerOrder({
      clientOrderId: `fake-${this.nextOrderId}`,
      symbol: String(params.symbol),
      side: String(params.side) === "SELL" ? "SELL" : "BUY",
      price: asNumber(params.price),
      quantity: asNumber(params.quantity),
    });

    this.send(client, id, 200, {
      cancelResult: "SUCCESS",
      cancelResponse: {
        ...this.toOrderResult(original),
        origClientOrderId: original.clientOrderId,
      },
      newOrderResult: "SUCCESS",
      newOrderResponse: this.toOrderResult(replacement),
    });
  }

  // Responde como account.status com omitZeroBalances: só ativos com saldo.
  private handleAccountStatus(client: WebSocket, id: string) {
    const balances = [...this.freeBalances]
      .filter(([, free]) => free > 0)
      .map(([asset, free]) => ({ asset, free: asString(free), locked: "0" }));
    this.send(client, id, 200, { accountType: "SPOT", balances });
  }

  private toOrderResult(order: FakeOrder) {
    return {
      symbol: order.symbol,
      orderId: order.orderId,
      orderListId: -1,
      clientOrderId: order.clientOrderId,
      origClientOrderId: order.clientOrderId,
      price: asString(order.price),
      origQty: asString(order.quantity),
      executedQty: asString(order.executedQty),
      cummulativeQuoteQty: asString(order.executedQty * order.price),
      status: order.status,
      timeInForce: "GTC",
      type: "LIMIT",
      side: order.side,
      stopPrice: "0",
      icebergQty: "0",
      time: Date.now(),
      updateTime: Date.now(),
      isWorking: isOpenOrder(order),
      workingTime: Date.now(),
      origQuoteOrderQty: "0",
      selfTradePreventionMode: "NONE",
    };
  }

  private send(
    client: WebSocket,
    id: string,
    status: number,
    result?: any,
    code?: number,
    msg?: string
  ) {
    client.send(
      JSON.stringify({
        id,
        status,
        ...(result === undefined ? {} : { result }),
        ...(code === undefined ? {} : { error: { code, msg } }),
      })
    );
  }

  private writeJson(response: ServerResponse, status: number, body: any) {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(body));
  }
}
