import amqp from "amqplib";
import mongoose, { Types } from "mongoose";
import Redis from "ioredis";
import { BotModel } from "../models/bot";
import { OrderModel } from "../models/order";
import { SessionModel } from "../models/session";
import { SymbolConfigModel } from "../models/symbolConfig";
import {
  ApplicationProcess,
  createTestPrivateKey,
  getFreePort,
} from "./support/app-process";
import { FakeBinance, FakeBinanceCommand } from "./support/fake-binance";

const MONGO_URI = process.env.MONGO_URI!;
const RABBITMQ_URI = process.env.RABBITMQ_URI!;
const REDIS_URI = process.env.REDIS_URI!;
const PARTIAL_FILL_GRACE_MS = Number(process.env.PARTIAL_FILL_GRACE_MS);
const FULL_FILL_DELAY_MS = 10_000;

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  description: string,
  timeout = 30_000
) {
  const deadline = Date.now() + timeout;
  let lastValue: T | undefined;

  while (Date.now() < deadline) {
    lastValue = await read();
    if (predicate(lastValue)) return lastValue;
    await delay(100);
  }

  throw new Error(
    `Timed out waiting for ${description}. Last value: ${JSON.stringify(
      lastValue,
      (_, value) => (value instanceof Types.ObjectId ? value.toString() : value)
    )}`
  );
}

async function purgeRabbitQueues() {
  const connection = await amqp.connect(RABBITMQ_URI);
  const channel = await connection.createChannel();

  await channel.assertQueue("messages", { durable: true });
  await channel.assertQueue("socket", { durable: true });
  await channel.purgeQueue("messages");
  await channel.purgeQueue("socket");
  await channel.close();
  await connection.close();
}

async function resetInfrastructure(redis: Redis) {
  await mongoose.connection.dropDatabase();
  await redis.flushdb();
  await purgeRabbitQueues();
}

interface ScenarioFixture {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  botId: Types.ObjectId;
  oldBuyId: string;
  oldSellId: string;
  partialQty: number;
  fullQty: number;
  initialCrypto: number;
}

async function createScenarioFixture(
  suffix: string
): Promise<ScenarioFixture> {
  const userId = new Types.ObjectId();
  const sessionId = new Types.ObjectId();
  const botId = new Types.ObjectId();
  const oldBuyId = `e2e-${suffix}-old-buy`;
  const oldSellId = `e2e-${suffix}-old-sell`;
  const initialCrypto = 1;
  const fullQty = 0.02;
  const partialQty = 0.01;

  await SessionModel.create({
    _id: sessionId,
    userId,
    apiKey: `e2e-api-key-${suffix}`,
    status: "active",
    name: `e2e-session-${suffix}`,
  });

  return {
    userId,
    sessionId,
    botId,
    oldBuyId,
    oldSellId,
    partialQty,
    fullQty,
    initialCrypto,
  };
}

async function populateScenarioFixture(
  fakeBinance: FakeBinance,
  fixture: ScenarioFixture
) {
  await BotModel.create({
    _id: fixture.botId,
    name: `e2e-bot-${fixture.botId.toString()}`,
    sessionId: fixture.sessionId,
    userId: fixture.userId,
    symbol: "BTCBRL",
    status: "active",
    limit: 1_000,
    mode: "manager",
    target: 100,
    brl: 1_000,
    crypto: fixture.initialCrypto,
  });

  await SymbolConfigModel.create({
    symbol: "BTCBRL",
    priceDecimal: 2,
    qtdDecimal: 4,
    minValue: 1,
  });

  await OrderModel.create([
    {
      userId: fixture.userId,
      botId: fixture.botId,
      sessionId: fixture.sessionId,
      mode: "manager",
      symbol: "BTCBRL",
      price: 80,
      quantity: fixture.fullQty,
      value: 1.6,
      direction: "buy",
      binanceId: fixture.oldBuyId,
      clientId: `${fixture.oldBuyId}-client`,
      executedQtd: 0,
      status: "active",
    },
    {
      userId: fixture.userId,
      botId: fixture.botId,
      sessionId: fixture.sessionId,
      mode: "manager",
      symbol: "BTCBRL",
      price: 120,
      quantity: fixture.fullQty,
      value: 2.4,
      direction: "sell",
      binanceId: fixture.oldSellId,
      clientId: `${fixture.oldSellId}-client`,
      executedQtd: 0,
      status: "active",
    },
  ]);

  fakeBinance.registerOrder({
    clientOrderId: fixture.oldBuyId,
    symbol: "BTCBRL",
    side: "BUY",
    price: 80,
    quantity: fixture.fullQty,
  });
  fakeBinance.registerOrder({
    clientOrderId: fixture.oldSellId,
    symbol: "BTCBRL",
    side: "SELL",
    price: 120,
    quantity: fixture.fullQty,
  });
}

function isOrderMutation(command: FakeBinanceCommand) {
  return ["order.place", "order.cancel", "order.cancelReplace"].includes(
    command.method
  );
}

function isCancellationOf(command: FakeBinanceCommand, clientOrderId: string) {
  return (
    (command.method === "order.cancel" &&
      command.params.origClientOrderId === clientOrderId) ||
    (command.method === "order.cancelReplace" &&
      command.params.cancelOrigClientOrderId === clientOrderId)
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

async function runWithApplication(
  testName: string,
  scenario: (
    fixture: ScenarioFixture,
    fakeBinance: FakeBinance,
    app: ApplicationProcess
  ) => Promise<void>
) {
  const fakeBinance = new FakeBinance();
  const fakeConnection = await fakeBinance.start();
  const privateKey = await createTestPrivateKey();
  const port = await getFreePort();
  const app = new ApplicationProcess();
  const suffix = `${testName}-${Date.now()}`;

  try {
    const fixture = await createScenarioFixture(suffix);

    await app.start({
      MONGO_URI,
      RABBITMQ_URI,
      REDIS_URI,
      PORT: String(port),
      BINANCE_WS_URL: fakeConnection.wsUrl,
      BINANCE_REST_URL: fakeConnection.restUrl,
      BINANCE_PRIVATE_KEY_PATH: privateKey.filePath,
      PARTIAL_FILL_GRACE_MS: String(PARTIAL_FILL_GRACE_MS),
      JWT_SECRET: "e2e-secret",
    });

    await waitFor(
      async () => SessionModel.findById(fixture.sessionId).select("status").lean(),
      (session) => session?.status === "active",
      "the E2E session to become active"
    );
    await populateScenarioFixture(fakeBinance, fixture);
    await scenario(fixture, fakeBinance, app);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\n\nApplication logs:\n${app.getLogs()}\n\nFake Binance commands:\n${JSON.stringify(
        fakeBinance.getCommandSummary(),
        null,
        2
      )}`
    );
  } finally {
    await app.stop();
    await fakeBinance.close();
    await privateKey.cleanup();
  }
}

describe("manager orders with partial fills", () => {
  let redis: Redis;

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI);
    redis = new Redis(REDIS_URI);
    await redis.ping();
  });

  beforeEach(async () => {
    await resetInfrastructure(redis);
  });

  afterAll(async () => {
    await redis.quit();
    await mongoose.disconnect();
  });

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
