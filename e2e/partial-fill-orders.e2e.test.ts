import { BotModel } from "../models/bot";
import { OrderModel } from "../models/order";
import { FakeBinanceCommand } from "./fake-binance/fake-binance";
import {
  PARTIAL_FILL_GRACE_MS,
  ScenarioFixture,
  delay,
  isCancellationOf,
  runWithApplication,
  useE2EInfrastructure,
  waitFor,
} from "./support/scenario";

const FULL_FILL_DELAY_MS = 10_000;

function isOrderMutation(command: FakeBinanceCommand) {
  return ["order.place", "order.cancel", "order.cancelReplace"].includes(
    command.method
  );
}

async function readFinalState(fixture: ScenarioFixture) {
  const [activeOrders, oldOrders, bot] = await Promise.all([
    OrderModel.find({ botId: fixture.botId, status: "active" })
      .select("direction binanceId executedQtd")
      .lean(),
    OrderModel.find({
      botId: fixture.botId,
      binanceId: { $in: [fixture.oldBuyId, fixture.oldSellId] },
    })
      .select("binanceId status executedQtd")
      .lean(),
    BotModel.findById(fixture.botId).select("crypto").lean(),
  ]);

  return { activeOrders, oldOrders, bot };
}

describe("manager orders with partial fills", () => {
  useE2EInfrastructure();

  it("cancels a partial order before creating replacements when no further fill arrives", async () => {
    await runWithApplication("no-fill", async (fixture, fakeBinance) => {
      const initialCommandCount = fakeBinance.getCommands().length;

      fakeBinance.emitExecutionReport({
        clientOrderId: fixture.oldSellId,
        status: "PARTIALLY_FILLED",
        executedQty: fixture.partialQty,
      });

      await waitFor(
        async () =>
          OrderModel.findOne({ binanceId: fixture.oldSellId })
            .select("status executedQtd")
            .lean(),
        (order) =>
          order?.status === "executed" &&
          order.executedQtd === fixture.partialQty,
        "the partial execution to be persisted"
      );

      await delay(500);
      expect(
        fakeBinance
          .getCommands()
          .slice(initialCommandCount)
          .filter(isOrderMutation)
      ).toHaveLength(0);

      const finalState = await waitFor(
        async () => {
          const repeatedCancellations = fakeBinance
            .getCommands()
            .filter((command) => isCancellationOf(command, fixture.oldSellId));
          if (repeatedCancellations.length > 1) {
            throw new Error(
              `Detected repeated cancellation of ${fixture.oldSellId}: ${repeatedCancellations.length} attempts`
            );
          }
          return readFinalState(fixture);
        },
        (state) =>
          state.activeOrders.length === 2 &&
          state.oldOrders.length === 2 &&
          state.oldOrders.every((order) => order.status === "closed") &&
          state.bot?.crypto ===
            Number((fixture.initialCrypto - fixture.partialQty).toFixed(8)),
        "the two replacement orders after partial cancellation",
        PARTIAL_FILL_GRACE_MS + 20_000
      );

      const commands = fakeBinance
        .getCommands()
        .slice(initialCommandCount)
        .filter(isOrderMutation);
      const cancellationIndex = commands.findIndex((command) =>
        isCancellationOf(command, fixture.oldSellId)
      );
      const firstNewOrderIndex = commands.findIndex((command) =>
        ["order.place", "order.cancelReplace"].includes(command.method)
      );

      expect(cancellationIndex).toBeGreaterThanOrEqual(0);
      expect(firstNewOrderIndex).toBeGreaterThan(cancellationIndex);
      expect(
        commands.filter((command) => isCancellationOf(command, fixture.oldSellId))
      ).toHaveLength(1);
      expect(finalState.activeOrders.map((order) => order.direction).sort()).toEqual([
        "buy",
        "sell",
      ]);
      expect(
        finalState.activeOrders.every(
          (order) =>
            ![fixture.oldBuyId, fixture.oldSellId].includes(order.binanceId) &&
            order.executedQtd === 0
        )
      ).toBe(true);
    });
  });

  it("does not cancel a partial order that fills completely after ten seconds", async () => {
    await runWithApplication("fills", async (fixture, fakeBinance) => {
      const initialCommandCount = fakeBinance.getCommands().length;

      fakeBinance.emitExecutionReport({
        clientOrderId: fixture.oldSellId,
        status: "PARTIALLY_FILLED",
        executedQty: fixture.partialQty,
      });

      await waitFor(
        async () => OrderModel.findOne({ binanceId: fixture.oldSellId }).lean(),
        (order) => order?.executedQtd === fixture.partialQty,
        "the partial execution before the final fill"
      );

      await delay(FULL_FILL_DELAY_MS);

      fakeBinance.emitExecutionReport({
        clientOrderId: fixture.oldSellId,
        status: "FILLED",
        executedQty: fixture.fullQty,
      });

      const finalState = await waitFor(
        () => readFinalState(fixture),
        (state) =>
          state.activeOrders.length === 2 &&
          state.oldOrders.length === 2 &&
          state.oldOrders.every((order) => order.status === "closed") &&
          state.bot?.crypto ===
            Number((fixture.initialCrypto - fixture.fullQty).toFixed(8)),
        "the two replacement orders after the final fill"
      );

      const commandsBeforeQuietPeriod = fakeBinance.getCommands().length;
      await delay(
        Math.max(1_000, PARTIAL_FILL_GRACE_MS - FULL_FILL_DELAY_MS + 1_500)
      );
      const commandsAfterQuietPeriod = fakeBinance.getCommands();
      const commands = commandsAfterQuietPeriod
        .slice(initialCommandCount)
        .filter(isOrderMutation);

      expect(commandsAfterQuietPeriod.length).toBe(commandsBeforeQuietPeriod);
      expect(
        commands.filter((command) => isCancellationOf(command, fixture.oldSellId))
      ).toHaveLength(0);
      expect(commands.filter((command) => ["order.place", "order.cancelReplace"].includes(command.method))).toHaveLength(2);
      expect(finalState.activeOrders.map((order) => order.direction).sort()).toEqual([
        "buy",
        "sell",
      ]);
      expect(
        finalState.activeOrders.every(
          (order) =>
            ![fixture.oldBuyId, fixture.oldSellId].includes(order.binanceId) &&
            order.executedQtd === 0
        )
      ).toBe(true);
    });
  });
});
