import { Types } from "mongoose";
import { ApplicationProcess } from "../app-runner/app-process";
import {
  TESTNET_REST_URL,
  TESTNET_WS_URL,
  TestnetClient,
  readTestnetCredentials,
} from "../binance-testnet/testnet-client";
import {
  createScenarioSession,
  startApplication,
  withApplicationLogs,
} from "./scenario";

export interface TestnetScenario {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  testnet: TestnetClient;
}

// Sobe a aplicação contra o Spot Testnet da Binance, executa o cenário e encerra.
// As ordens abertas do símbolo são canceladas antes e depois: a conta do testnet é
// compartilhada entre os cenários e cada um começa com o livro dela limpo.
export async function runWithTestnet(
  testName: string,
  symbol: string,
  scenario: (context: TestnetScenario) => Promise<void>
) {
  const credentials = readTestnetCredentials();
  const testnet = new TestnetClient(credentials);
  const app = new ApplicationProcess();

  await testnet.cancelOpenOrders(symbol);
  try {
    const session = await createScenarioSession(
      `${testName}-${Date.now()}`,
      credentials.apiKey
    );
    await startApplication(
      app,
      {
        wsUrl: TESTNET_WS_URL,
        restUrl: TESTNET_REST_URL,
        privateKeyPath: credentials.privateKeyPath,
      },
      session.sessionId
    );
    await scenario({ ...session, testnet });
  } catch (error) {
    throw withApplicationLogs(error, app);
  } finally {
    await app.stop();
    await testnet.cancelOpenOrders(symbol);
  }
}
