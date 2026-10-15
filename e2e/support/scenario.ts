import amqp from "amqplib";
import { Queue } from "bullmq";
import mongoose, { Types } from "mongoose";
import Redis from "ioredis";
import { BotModel } from "../../models/bot";
import { OrderModel } from "../../models/order";
import { SessionModel } from "../../models/session";
import { SymbolConfigModel } from "../../models/symbolConfig";
import {
  ApplicationProcess,
  createTestPrivateKey,
  getFreePort,
} from "../app-runner/app-process";
import { FakeBinance, FakeBinanceCommand } from "../fake-binance/fake-binance";

const MONGO_URI = process.env.MONGO_URI!;
const RABBITMQ_URI = process.env.RABBITMQ_URI!;
const REDIS_URI = process.env.REDIS_URI!;
export const PARTIAL_FILL_GRACE_MS = Number(process.env.PARTIAL_FILL_GRACE_MS);

export function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitFor<T>(
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

export function useE2EInfrastructure() {
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
}

export interface ScenarioFixture {
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

// Publica na mesma fila do BullMQ que a aplicação consome para rodar o manager.
export async function triggerManagerRun(botId: Types.ObjectId) {
  const connection = new Redis(REDIS_URI, { maxRetriesPerRequest: null });
  const queue = new Queue("activate-bot", { connection: connection as any });

  await queue.add(
    "runManagerBot",
    { botId: botId.toString() },
    { removeOnComplete: true }
  );
  await queue.close();
  await connection.quit();
}

// TTL em segundos de uma chave do Redis da aplicação (-2 quando a chave não existe).
export async function readRedisTtl(key: string) {
  const connection = new Redis(REDIS_URI);
  try {
    return await connection.ttl(key);
  } finally {
    await connection.quit();
  }
}

export function isCancellationOf(
  command: FakeBinanceCommand,
  clientOrderId: string
) {
  return (
    (command.method === "order.cancel" &&
      command.params.origClientOrderId === clientOrderId) ||
    (command.method === "order.cancelReplace" &&
      command.params.cancelOrigClientOrderId === clientOrderId)
  );
}

export async function runWithApplication(
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
