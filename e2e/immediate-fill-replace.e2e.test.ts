import { BotModel } from "../models/bot";
import { OrderModel } from "../models/order";
import { FakeBinance } from "./fake-binance/fake-binance";
import {
  ScenarioFixture,
  delay,
  runWithApplication,
  triggerManagerRun,
  useE2EInfrastructure,
  waitFor,
} from "./support/scenario";

// Com o fixture (target 100, crypto 1, variância mínima de 1%) o manager reposiciona
// a compra em 99 e a venda em 101. Cada preço de mercado abaixo cruza só um desses lados.
const directions = [
  { direction: "sell", side: "SELL", marketPrice: 101.5 },
  { direction: "buy", side: "BUY", marketPrice: 98.5 },
] as const;

// A execução é tratada em dois lugares: no executionReport do user stream e na resposta
// do request. O intervalo garante que a aplicação termine de tratar a primeira mensagem
// antes de a segunda chegar.
const deliveryOrders = [
  { timing: "before-response", deliveries: ["executionReport", "response"] },
  { timing: "after-response", deliveries: ["response", "executionReport"] },
] as const;
const DELIVERY_GAP_MS = 1_000;

function filledOnExchange(fakeBinance: FakeBinance) {
  return fakeBinance.getOrders().filter((order) => order.status === "FILLED");
}

function expectedCrypto(fixture: ScenarioFixture, fakeBinance: FakeBinance) {
  const delta = filledOnExchange(fakeBinance).reduce(
    (sum, order) =>
      sum + (order.side === "BUY" ? order.executedQty : -order.executedQty),
    0
  );
  return Number((fixture.initialCrypto + delta).toFixed(8));
}

function deliveriesOf(fakeBinance: FakeBinance, clientOrderId: string) {
  return fakeBinance
    .getDeliveries()
    .filter((delivery) => delivery.clientOrderId === clientOrderId)
    .map((delivery) => delivery.kind);
}

async function readFinalState(fixture: ScenarioFixture) {
  const [activeOrders, unsettledOrders, bot] = await Promise.all([
    OrderModel.find({ botId: fixture.botId, status: "active" })
      .select("direction binanceId executedQtd")
      .lean(),
    OrderModel.find({
      botId: fixture.botId,
      status: { $in: ["pending", "executed", "partialExecuted"] },
    })
      .select("direction binanceId status executedQtd")
      .lean(),
    BotModel.findById(fixture.botId).select("crypto").lean(),
  ]);

  return { activeOrders, unsettledOrders, crypto: bot?.crypto };
}

describe("manager replacement order filled immediately", () => {
  useE2EInfrastructure();

  describe.each(deliveryOrders)(
    "when the execution report arrives $timing",
    ({ timing, deliveries }) => {
      it.each(directions)(
        "accounts the $direction fill once and keeps one buy and one sell",
        async ({ direction, side, marketPrice }) => {
          await runWithApplication(
            `immediate-${direction}-${timing}`,
            async (fixture, fakeBinance) => {
              fakeBinance.setMarketPrice(marketPrice);
              fakeBinance.setFillReportTiming(timing, DELIVERY_GAP_MS);

              await triggerManagerRun(fixture.botId);

              await waitFor(
                () => readFinalState(fixture),
                (state) =>
                  filledOnExchange(fakeBinance).length > 0 &&
                  state.unsettledOrders.length === 0 &&
                  state.activeOrders.length === 2 &&
                  state.crypto === expectedCrypto(fixture, fakeBinance),
                `the immediate ${direction} fill to be accounted for`
              );

              // Espera a segunda mensagem e as reposições seguintes antes de comparar.
              await delay(DELIVERY_GAP_MS + 3_000);
              const finalState = await readFinalState(fixture);
              const filledOrders = filledOnExchange(fakeBinance);
              const openOnExchange = fakeBinance
                .getOrders()
                .filter((order) => order.status === "NEW")
                .map((order) => order.clientOrderId)
                .sort();

              expect(filledOrders.map((order) => order.side)).toEqual([side]);
              expect(
                deliveriesOf(fakeBinance, filledOrders[0].clientOrderId)
              ).toEqual(deliveries);
              expect(finalState.unsettledOrders).toHaveLength(0);
              expect(finalState.crypto).toBe(
                expectedCrypto(fixture, fakeBinance)
              );
              expect(
                finalState.activeOrders.map((order) => order.direction).sort()
              ).toEqual(["buy", "sell"]);
              expect(
                finalState.activeOrders.map((order) => order.binanceId).sort()
              ).toEqual(openOnExchange);
            }
          );
        }
      );
    }
  );
});
