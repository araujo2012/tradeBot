import { BotModel } from "../models/bot";
import { OrderModel } from "../models/order";
import { FakeBinance } from "./fake-binance/fake-binance";
import {
  ScenarioFixture,
  delay,
  readRedisTtl,
  runWithApplication,
  triggerManagerRun,
  useE2EInfrastructure,
  waitFor,
} from "./support/scenario";

// Com o fixture (target 100, crypto 1) e a compra antiga executada, o manager envia
// por order.place uma compra nova de 0,0104 a 97,05: cerca de 1 BRL.
// Os saldos abaixo ficam longe desse valor para cada lado.
const STALE_LOW_BRL = 0.2;
const NOT_ENOUGH_BRL = 0.5;
const ENOUGH_BRL = 500;
const LOCK_SECONDS = 10 * 60;

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

function readLockTtl(fixture: ScenarioFixture) {
  return readRedisTtl(`bot:insufficient-balance:${fixture.botId}`);
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

// Venda que o manager repôs no lugar da antiga na mesma rodada da compra.
function readReplacementSell(fixture: ScenarioFixture) {
  return OrderModel.findOne({
    botId: fixture.botId,
    direction: "sell",
    status: "active",
    binanceId: { $ne: fixture.oldSellId },
  })
    .select("binanceId quantity")
    .lean();
}

// Sem saldo local nem na conta: a compra nova é barrada e o bot fica travado.
async function runOutOfBalance(
  fixture: ScenarioFixture,
  fakeBinance: FakeBinance
) {
  fakeBinance.setFreeBalance("BRL", NOT_ENOUGH_BRL);
  await setLocalBrl(fixture, STALE_LOW_BRL);

  fillOldBuy(fixture, fakeBinance);

  await waitFor(
    () => readLockTtl(fixture),
    (ttl) => ttl > 0,
    "the bot to be locked for insufficient balance"
  );
  return waitFor(
    () => readReplacementSell(fixture),
    (sell) => sell !== null,
    "the sell replacement from the same manager run"
  );
}

function expectLockedForTenMinutes(ttl: number) {
  expect(ttl).toBeGreaterThan(LOCK_SECONDS - 30);
  expect(ttl).toBeLessThanOrEqual(LOCK_SECONDS);
}

describe("manager buy order with insufficient balance", () => {
  useE2EInfrastructure();

  it("refreshes the bot balance and locks the bot when Binance rejects the buy for insufficient balance", async () => {
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
      expectLockedForTenMinutes(await readLockTtl(fixture));
    });
  });

  it("does not send the buy and only refreshes the balance when the account is still short", async () => {
    await runWithApplication("still-short", async (fixture, fakeBinance) => {
      await runOutOfBalance(fixture, fakeBinance);

      expect(await readBotBrl(fixture)).toBe(NOT_ENOUGH_BRL);
      expect(commandsOf(fakeBinance, "account.status")).toHaveLength(1);
      expect(commandsOf(fakeBinance, "order.place")).toHaveLength(0);
      expect(await readBuyOrders(fixture)).toHaveLength(0);
      expectLockedForTenMinutes(await readLockTtl(fixture));
    });
  });

  it("does not run a locked bot", async () => {
    await runWithApplication("locked", async (fixture, fakeBinance) => {
      await runOutOfBalance(fixture, fakeBinance);
      // Espera a rodada que a reposição da venda dispara, já barrada pelo lock.
      await delay(1_000);
      const commandCount = fakeBinance.getCommands().length;

      await triggerManagerRun(fixture.botId);
      // Sem o lock, a rodada mandaria outro account.status em poucos milissegundos.
      await delay(2_000);

      expect(fakeBinance.getCommands()).toHaveLength(commandCount);
      expect(commandsOf(fakeBinance, "account.status")).toHaveLength(1);
      expect(await readBuyOrders(fixture)).toHaveLength(0);
    });
  });

  it("releases the lock and buys again when an order of the bot is filled", async () => {
    await runWithApplication("released", async (fixture, fakeBinance) => {
      const sell = await runOutOfBalance(fixture, fakeBinance);
      // A venda executada credita BRL na conta.
      fakeBinance.setFreeBalance("BRL", ENOUGH_BRL);

      fakeBinance.emitExecutionReport({
        clientOrderId: sell!.binanceId,
        status: "FILLED",
        executedQty: sell!.quantity,
      });

      const buyOrders = await waitFor(
        () => readBuyOrders(fixture),
        (orders) => orders.some((order) => order.status === "active"),
        "the buy order to be placed after the sell fill"
      );

      expect(buyOrders).toHaveLength(1);
      expect(await readBotBrl(fixture)).toBe(ENOUGH_BRL);
      expect(await readLockTtl(fixture)).toBe(-2);
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
      expect(await readLockTtl(fixture)).toBe(-2);
    });
  });
});
