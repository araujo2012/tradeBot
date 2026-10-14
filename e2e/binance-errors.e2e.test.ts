import mongoose from "mongoose";
import { OrderModel } from "../models/order";
import {
  PARTIAL_FILL_GRACE_MS,
  isCancellationOf,
  runWithApplication,
  useE2EInfrastructure,
  waitFor,
} from "./support/scenario";

const DEBUG_COLLECTION = "debuger";

describe("Binance error handling", () => {
  useE2EInfrastructure();

  it("records a debug entry when Binance rejects an order cancellation", async () => {
    await runWithApplication("debug", async (fixture, fakeBinance) => {
      fakeBinance.emitExecutionReport({
        clientOrderId: fixture.oldSellId,
        status: "PARTIALLY_FILLED",
        executedQty: fixture.partialQty,
      });

      await waitFor(
        async () => OrderModel.findOne({ binanceId: fixture.oldSellId }).lean(),
        (order) => order?.executedQtd === fixture.partialQty,
        "the partial execution to be persisted"
      );

      fakeBinance.cancelOrderWithoutNotifying(fixture.oldSellId);

      const [debugEntry] = await waitFor(
        () =>
          mongoose.connection
            .collection(DEBUG_COLLECTION)
            .find({ method: "order.cancel" })
            .toArray(),
        (entries) => entries.length > 0,
        `a debug entry in '${DEBUG_COLLECTION}' for the rejected cancellation`,
        PARTIAL_FILL_GRACE_MS + 20_000
      );
      const rejectedCancellation = fakeBinance
        .getCommands()
        .find((command) => isCancellationOf(command, fixture.oldSellId));

      expect(debugEntry).toMatchObject({
        method: "order.cancel",
        requestId: rejectedCancellation?.id,
        status: 400,
        error: { code: -2011, msg: "Unknown order sent." },
        params: { symbol: "BTCBRL", origClientOrderId: fixture.oldSellId },
      });
      expect(String(debugEntry.sessionId)).toBe(fixture.sessionId.toString());
      expect(debugEntry.createdAt).toBeInstanceOf(Date);
      expect(debugEntry.params).not.toHaveProperty("signature");
      expect(debugEntry.params).not.toHaveProperty("apiKey");
    });
  });
});
