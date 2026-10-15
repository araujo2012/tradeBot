import { BotModel } from "../models/bot";
import { OrderModel } from "../models/order";
import { FakeBinance } from "./fake-binance/fake-binance";
import {
  ScenarioFixture,
  delay,
  runWithApplication,
  useE2EInfrastructure,
  waitFor,
} from "./support/scenario";

// Com o fixture (target 100, crypto 1) e a compra antiga executada, o manager envia
// por order.place uma compra nova de 0,0104 a 97,05: cerca de 1 BRL.
// Os saldos abaixo ficam longe desse valor para cada lado.
const STALE_LOW_BRL = 0.2;
const NOT_ENOUGH_BRL = 0.5;
const ENOUGH_BRL = 500;

// Executa a compra antiga: o manager roda sem compra ativa e cria uma nova.
function fillOldBuy(fixture: ScenarioFixture, fakeBinance: FakeBinance) {
  fakeBinance.emitExecutionReport({
    clientOrderId: fixture.oldBuyId,
    status: "FILLED",
    executedQty: fixture.fullQty,
  });
}

function setLocalBrl(fixture: ScenarioFixture, brl: number) {
  return BotModel.updateOne({ _id: fixture.botId }, { brl });
}

async function readBotBrl(fixture: ScenarioFixture) {
  const bot = await BotModel.findById(fixture.botId).select("brl").lean();
  return bot?.brl;
}

function commandsOf(fakeBinance: FakeBinance, method: string) {
  return fakeBinance.getCommands().filter((command) => command.method === method);
}

function readBuyOrders(fixture: ScenarioFixture) {
  return OrderModel.find({
    botId: fixture.botId,
    direction: "buy",
    binanceId: { $ne: fixture.oldBuyId },
  })
    .select("status clientId binanceId")
    .lean();
}

describe("manager buy order with insufficient balance", () => {
  useE2EInfrastructure();

  it("refreshes the bot balance when Binance rejects the buy for insufficient balance", async () => {
    await runWithApplication("rejected", async (fixture, fakeBinance) => {
      fakeBinance.setFreeBalance("BRL", NOT_ENOUGH_BRL);

      fillOldBuy(fixture, fakeBinance);

      await waitFor(
        () => readBotBrl(fixture),
        (brl) => brl === NOT_ENOUGH_BRL,
        "the bot balance to be refreshed after the rejection"
      );

      const [rejectedPlace] = commandsOf(fakeBinance, "order.place");
      const [accountStatus] = commandsOf(fakeBinance, "account.status");
      const buyOrders = await readBuyOrders(fixture);

      expect(rejectedPlace.params).toMatchObject({ side: "BUY" });
      expect(accountStatus.sequence).toBeGreaterThan(rejectedPlace.sequence);
      expect(buyOrders).toEqual([
        expect.objectContaining({ clientId: rejectedPlace.id, status: "closed" }),
      ]);
    });
  });

  it("does not send the buy and only refreshes the balance when the account is still short", async () => {
    await runWithApplication("still-short", async (fixture, fakeBinance) => {
      fakeBinance.setFreeBalance("BRL", NOT_ENOUGH_BRL);
      await setLocalBrl(fixture, STALE_LOW_BRL);

      fillOldBuy(fixture, fakeBinance);

      await waitFor(
        () => readBotBrl(fixture),
        (brl) => brl === NOT_ENOUGH_BRL,
        "the bot balance to be refreshed from the account"
      );
      // Dá tempo de um order.place indevido chegar antes de conferir.
      await delay(1_000);

      expect(commandsOf(fakeBinance, "account.status").length).toBeGreaterThan(0);
      expect(commandsOf(fakeBinance, "order.place")).toHaveLength(0);
      expect(await readBuyOrders(fixture)).toHaveLength(0);
    });
  });

  it("sends the buy after refreshing the balance when the account has enough", async () => {
    await runWithApplication("enough", async (fixture, fakeBinance) => {
      fakeBinance.setFreeBalance("BRL", ENOUGH_BRL);
      await setLocalBrl(fixture, STALE_LOW_BRL);

      fillOldBuy(fixture, fakeBinance);

      const buyOrders = await waitFor(
        () => readBuyOrders(fixture),
        (orders) => orders.some((order) => order.status === "active"),
        "the buy order to be placed after the balance refresh"
      );

      const [accountStatus] = commandsOf(fakeBinance, "account.status");
      const [place] = commandsOf(fakeBinance, "order.place");

      expect(await readBotBrl(fixture)).toBe(ENOUGH_BRL);
      expect(place.params).toMatchObject({ side: "BUY" });
      expect(place.sequence).toBeGreaterThan(accountStatus.sequence);
      expect(buyOrders).toEqual([
        expect.objectContaining({ clientId: place.id, status: "active" }),
      ]);
    });
  });
});
