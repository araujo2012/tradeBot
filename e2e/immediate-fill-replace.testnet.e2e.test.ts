import { Types } from "mongoose";
import { normalizeValue } from "../app/order/order.utils";
import { BotModel } from "../models/bot";
import { OrderModel } from "../models/order";
import { SymbolConfigModel } from "../models/symbolConfig";
import { WebsocketDataModel } from "../models/websocketData";
import {
  BookTicker,
  OrderSide,
  SymbolRules,
  TestnetClient,
  TestnetOrder,
} from "./binance-testnet/testnet-client";
import {
  delay,
  readRedisTtl,
  triggerManagerRun,
  useE2EInfrastructure,
  waitFor,
} from "./support/scenario";
import { TestnetScenario, runWithTestnet } from "./support/testnet-scenario";

const SYMBOL = "BTCBRL";
// As ordens antigas ficam a 10% do mercado: no livro, sem serem executadas.
const OLD_ORDER_MARGIN = 0.1;
// Variância que o manager usa: minValue / target. A de Bollinger do BTCBRL (1h)
// fica bem abaixo dela, então prevalece a variância mínima.
const VARIANCE = 0.05;
// Quanto a reposição cruza o livro: ela é executada mesmo que o preço mude um pouco
// até chegar à Binance.
const CROSS_MARGIN = 0.02;
// Mais que o backoff de 5 s do BullMQ: dá tempo de a rodada seguinte do manager rodar.
const QUIET_PERIOD_MS = 7_000;
const SCENARIO_TIMEOUT_MS = 150_000;
const UNSETTLED_STATUS = ["pending", "executed", "partialExecuted"];
// Status que a ordem deve ter no banco para cada status dela na Binance.
const DB_STATUS_BY_EXCHANGE_STATUS: Record<string, string> = {
  NEW: "active",
  FILLED: "closed",
  CANCELED: "closed",
};

// O centro (target / crypto) define os preços do manager: venda em centro * (1 + variância)
// e compra em centro * (1 - variância). Cada centro faz só um lado cruzar o livro. Depois
// da execução, o centro anda (1 ± variância) na direção do mercado e nenhum lado cruza mais.
const directions = [
  {
    direction: "sell",
    side: "SELL",
    centerFor: ({ bid }: BookTicker) => (bid * (1 - CROSS_MARGIN)) / (1 + VARIANCE),
  },
  {
    direction: "buy",
    side: "BUY",
    centerFor: ({ ask }: BookTicker) => (ask * (1 + CROSS_MARGIN)) / (1 - VARIANCE),
  },
] as const;

// Na rodada que cruza o livro, o manager repõe as duas ordens antigas (2 cancelReplace) e uma
// delas é executada na hora. Na seguinte, cria a ordem do lado executado (order.place) e repõe
// a do outro lado, porque o centro andou (1 cancelReplace). Depois disso, não muda mais nada.
const EXPECTED_REQUESTS = {
  "session.logon": 1,
  "userDataStream.subscribe": 1,
  "order.cancelReplace": 3,
  "order.place": 1,
};

interface OldOrders {
  buy: TestnetOrder;
  sell: TestnetOrder;
}

// Valor das ordens do bot: o dobro do mínimo da Binance, com folga para o arredondamento.
function minOrderValue(rules: SymbolRules) {
  return 2 * rules.minNotional;
}

function placeOldOrder(
  testnet: TestnetClient,
  rules: SymbolRules,
  side: OrderSide,
  price: number
) {
  const quantity = normalizeValue({
    value: minOrderValue(rules) / price,
    decimal: rules.qtdDecimal,
    isRoundUp: true,
  });
  return testnet.placeLimitOrder({
    symbol: SYMBOL,
    side,
    price,
    quantity,
    clientOrderId: `e2e-old-${side.toLowerCase()}-${Date.now()}`,
  });
}

// Ordens já existentes do bot, criadas direto na Binance a 10% do mercado.
async function placeOldOrders(
  testnet: TestnetClient,
  rules: SymbolRules,
  book: BookTicker
): Promise<OldOrders> {
  const buyPrice = normalizeValue({
    value: book.bid * (1 - OLD_ORDER_MARGIN),
    decimal: rules.priceDecimal,
    isRoundUp: false,
  });
  const sellPrice = normalizeValue({
    value: book.ask * (1 + OLD_ORDER_MARGIN),
    decimal: rules.priceDecimal,
    isRoundUp: true,
  });
  const buy = await placeOldOrder(testnet, rules, "BUY", buyPrice);
  const sell = await placeOldOrder(testnet, rules, "SELL", sellPrice);

  expect([buy.status, sell.status]).toEqual(["NEW", "NEW"]);
  return { buy, sell };
}

function toBotOrder(
  order: TestnetOrder,
  botId: Types.ObjectId,
  { userId, sessionId }: TestnetScenario
) {
  const price = Number(order.price);
  const quantity = Number(order.origQty);
  return {
    userId,
    botId,
    sessionId,
    mode: "manager",
    symbol: SYMBOL,
    price,
    quantity,
    value: price * quantity,
    direction: order.side === "BUY" ? "buy" : "sell",
    binanceId: order.clientOrderId,
    clientId: order.clientOrderId,
    executedQtd: 0,
    status: "active",
  };
}

// Grava o bot com as ordens antigas e o centro que faz uma reposição cruzar o livro.
async function createBot(
  context: TestnetScenario,
  rules: SymbolRules,
  oldOrders: OldOrders,
  center: number
) {
  const minValue = minOrderValue(rules);
  const target = minValue / VARIANCE;
  const initialCrypto = Number((target / center).toFixed(8));
  const botId = new Types.ObjectId();

  await SymbolConfigModel.create({
    symbol: SYMBOL,
    priceDecimal: rules.priceDecimal,
    qtdDecimal: rules.qtdDecimal,
    minValue,
  });
  await OrderModel.create([
    toBotOrder(oldOrders.buy, botId, context),
    toBotOrder(oldOrders.sell, botId, context),
  ]);
  // O bot vem por último: uma rodada do manager (o Agenda roda a cada minuto) sem as
  // ordens antigas no banco criaria ordens novas em vez de repor as antigas.
  // O `brl` local cobre as compras, então a aplicação não consulta account.status.
  await BotModel.create({
    _id: botId,
    name: `e2e-bot-${botId.toString()}`,
    sessionId: context.sessionId,
    userId: context.userId,
    symbol: SYMBOL,
    status: "active",
    limit: 1_000,
    mode: "manager",
    target,
    brl: 1_000,
    crypto: initialCrypto,
  });

  return { botId, initialCrypto };
}

async function readBotState(botId: Types.ObjectId) {
  const [bot, orders, inFlightTtl] = await Promise.all([
    BotModel.findById(botId).select("crypto").lean(),
    OrderModel.find({ botId }).select("direction status").lean(),
    readRedisTtl(`bot:inflight:${botId}`),
  ]);
  return {
    crypto: bot?.crypto,
    unsettled: orders.filter((order) => UNSETTLED_STATUS.includes(order.status)),
    activeDirections: orders
      .filter((order) => order.status === "active")
      .map((order) => order.direction)
      .sort(),
    inFlightTtl,
  };
}

// Espera o manager contabilizar a execução: cripto atualizada, nenhuma ordem por liquidar,
// uma compra e uma venda ativas e nenhuma mensagem do bot pendente na fila do socket.
function waitForSettledBot(botId: Types.ObjectId, initialCrypto: number) {
  return waitFor(
    () => readBotState(botId),
    (state) =>
      state.crypto !== initialCrypto &&
      state.unsettled.length === 0 &&
      state.activeDirections.join() === "buy,sell" &&
      state.inFlightTtl === -2,
    "the manager to account the immediate fill and settle",
    90_000
  );
}

// Requests que a aplicação enviou à Binance, com a sessão do socket por onde saíram.
async function readSentRequests() {
  const sent = await WebsocketDataModel.find({ type: "sended" }).lean();
  return sent.map(({ sessionId, payload }) => ({
    sessionId,
    method: String(payload.message.method),
  }));
}

function countByMethod(requests: { method: string }[]) {
  return requests.reduce<Record<string, number>>((counts, { method }) => {
    counts[method] = (counts[method] ?? 0) + 1;
    return counts;
  }, {});
}

// Resposta da Binance ao order.cancelReplace que criou a ordem informada.
async function readReplaceReplyFor(clientOrderId: string) {
  const reply = await WebsocketDataModel.findOne({
    type: "received",
    "payload.result.newOrderResponse.clientOrderId": clientOrderId,
  }).lean();
  return reply?.payload;
}

// executionReports recebidos pelo user data stream sobre a ordem, na ordem de chegada.
async function readExecutionReports(clientOrderId: string) {
  const reports = await WebsocketDataModel.find({
    type: "received",
    "payload.event.e": "executionReport",
    "payload.event.c": clientOrderId,
  })
    .sort({ _id: 1 })
    .lean();
  return reports.map(({ payload }) => payload.event);
}

// Ordem do banco e ordem da Binance no mesmo formato, para comparar uma com a outra.
function fromExchange(order: TestnetOrder) {
  return {
    binanceId: order.clientOrderId,
    direction: order.side === "BUY" ? "buy" : "sell",
    price: Number(order.price),
    quantity: Number(order.origQty),
    executedQtd: Number(order.executedQty),
    status: DB_STATUS_BY_EXCHANGE_STATUS[order.status] ?? order.status,
  };
}

async function readComparableDbOrders(botId: Types.ObjectId) {
  const orders = await OrderModel.find({ botId }).lean();
  return orders.map(({ binanceId, direction, price, quantity, executedQtd, status }) => ({
    binanceId,
    direction,
    price,
    quantity,
    executedQtd,
    status,
  }));
}

function byBinanceId(a: { binanceId: string }, b: { binanceId: string }) {
  return a.binanceId.localeCompare(b.binanceId);
}

describe("manager replacement order filled immediately on the Binance testnet", () => {
  useE2EInfrastructure();

  it.each(directions)(
    "fills the $direction replacement as soon as it reaches Binance and accounts it once",
    async ({ direction, side, centerFor }) => {
      await runWithTestnet(`immediate-${direction}`, SYMBOL, async (context) => {
        const { testnet, sessionId } = context;
        const rules = await testnet.getSymbolRules(SYMBOL);
        const book = await testnet.getBookTicker(SYMBOL);
        const oldOrders = await placeOldOrders(testnet, rules, book);
        const oldOrderOfSide = side === "BUY" ? oldOrders.buy : oldOrders.sell;
        const { botId, initialCrypto } = await createBot(
          context,
          rules,
          oldOrders,
          centerFor(book)
        );

        await triggerManagerRun(botId);
        await waitForSettledBot(botId, initialCrypto);

        const requestsBeforeQuietPeriod = await readSentRequests();
        await delay(QUIET_PERIOD_MS);
        const requests = await readSentRequests();
        const exchangeOrders = await testnet.getOrdersSince(
          SYMBOL,
          oldOrders.buy.transactTime!
        );
        const filledOrders = exchangeOrders.filter(
          (order) => order.status === "FILLED"
        );

        // Na Binance, só a reposição do lado que cruzou o livro foi executada, por inteiro.
        expect(filledOrders.map((order) => order.side)).toEqual([side]);
        const [filled] = filledOrders;
        expect(filled.executedQty).toBe(filled.origQty);
        expect(
          exchangeOrders
            .filter((order) => order.status === "NEW")
            .map((order) => order.side)
            .sort()
        ).toEqual(["BUY", "SELL"]);

        // A resposta do order.cancelReplace já traz a ordem antiga cancelada e a nova executada.
        expect(await readReplaceReplyFor(filled.clientOrderId)).toMatchObject({
          status: 200,
          result: {
            cancelResult: "SUCCESS",
            cancelResponse: {
              origClientOrderId: oldOrderOfSide.clientOrderId,
              status: "CANCELED",
            },
            newOrderResult: "SUCCESS",
            newOrderResponse: { status: "FILLED", executedQty: filled.origQty },
          },
        });
        // O user data stream também avisou a execução completa.
        const reports = await readExecutionReports(filled.clientOrderId);
        expect(reports[reports.length - 1]).toMatchObject({
          X: "FILLED",
          z: filled.executedQty,
        });

        // O banco espelha a Binance: mesmas ordens, com status e quantidades equivalentes.
        expect((await readComparableDbOrders(botId)).sort(byBinanceId)).toEqual(
          exchangeOrders.map(fromExchange).sort(byBinanceId)
        );

        // O crypto do bot recebe a execução uma única vez.
        const bot = await BotModel.findById(botId).select("crypto").lean();
        const filledQty = Number(filled.executedQty);
        expect(bot?.crypto).toBeCloseTo(
          initialCrypto + (side === "BUY" ? filledQty : -filledQty),
          8
        );

        // Tudo saiu pelo socket da sessão, sem requests além das esperadas nem depois de estabilizar.
        expect(requests).toEqual(requestsBeforeQuietPeriod);
        expect(
          requests.filter((request) => request.sessionId !== sessionId.toString())
        ).toEqual([]);
        expect(countByMethod(requests)).toEqual(EXPECTED_REQUESTS);
      });
    },
    SCENARIO_TIMEOUT_MS
  );
});
